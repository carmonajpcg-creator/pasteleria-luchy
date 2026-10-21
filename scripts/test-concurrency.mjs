// Pruebas de concurrencia contra el proyecto Supabase DE PRUEBAS (CLAUDE.md §12: Playwright no sustituye
// las pruebas de carreras y transacciones). Varias conexiones directas actúan a la vez como anónimo o
// administrador, igual que lo harían peticiones simultáneas de la API.
//
// Requiere SUPABASE_DB_URL y LUCHY_ENTORNO=pruebas (barrera explícita: nunca contra producción).
// Usa un producto propio (SKU TEST-CONC) y borra todo lo que crea, aunque una prueba falle.
import pg from 'pg'

if (process.env.LUCHY_ENTORNO !== 'pruebas' || !process.env.SUPABASE_DB_URL) {
  console.error('Define SUPABASE_DB_URL y LUCHY_ENTORNO=pruebas. Esta suite escribe datos: solo en el proyecto de pruebas.')
  process.exit(2)
}

const config = { connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } }
const admin = new pg.Client(config)
await admin.connect()

let failed = 0
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failed++
}

const CUSTOMER = 'Prueba concurrencia'
const adminId = (await admin.query("select user_id from public.profiles where role = 'admin' limit 1")).rows[0]?.user_id
if (!adminId) {
  console.error('No hay un administrador en profiles.')
  process.exit(2)
}
const settingsBefore = (await admin.query('select daily_capacity from public.store_settings')).rows[0]
const tz = (await admin.query('select timezone from public.store_settings')).rows[0].timezone
const day = async (n) => (await admin.query(`select ((now() at time zone $1)::date + $2::int)::text d`, [tz, n])).rows[0].d

// Ejecuta `sql` en una conexión nueva como el rol indicado, en su propia transacción.
async function as(role, sql, params = []) {
  const c = new pg.Client(config)
  await c.connect()
  try {
    await c.query('begin')
    await c.query(`set local role ${role === 'admin' ? 'authenticated' : 'anon'}`)
    const claims = role === 'admin' ? { sub: adminId, role: 'authenticated' } : { role: 'anon' }
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
    const r = await c.query(sql, params)
    await c.query('commit')
    return { ok: true, rows: r.rows }
  } catch (e) {
    await c.query('rollback').catch(() => {})
    return { ok: false, error: e.message, code: e.code }
  } finally {
    await c.end()
  }
}

const stock = async () => (await admin.query("select stock_quantity s from public.products where sku = 'TEST-CONC'")).rows[0].s
const setStock = (n) => admin.query("update public.products set stock_quantity = $1 where sku = 'TEST-CONC'", [n])
let phoneSeq = 0
const nextPhone = () => `5599${String(Date.now() % 1_000_000).padStart(6, '0')}${phoneSeq++}`.slice(0, 15)

async function createOrder(productId, quantity, date, key = null) {
  const r = await as('anon',
    `select * from public.create_order(coalesce($1::uuid, gen_random_uuid()), $2, $3, null, 'delivery', $4::date, null, true,
       jsonb_build_array(jsonb_build_object('product_id', $5::uuid, 'quantity', $6::int)))`,
    [key, CUSTOMER, nextPhone(), date, productId, quantity])
  return r
}
const orderId = async (folio) => (await admin.query('select id from public.orders where folio = $1', [folio])).rows[0].id

let productId
try {
  const cat = (await admin.query('select id from public.categories order by sort_order limit 1')).rows[0].id
  productId = (await admin.query(
    `insert into public.products (category_id, sku, slug, name, price_cents, fulfillment_type, stock_quantity, active)
     values ($1, 'TEST-CONC', 'test-concurrencia', 'Producto de prueba de concurrencia', 1000, 'stock', 0, true)
     on conflict (sku) do update set stock_quantity = 0, active = true returning id`, [cat])).rows[0].id
  const date = await day(5)

  // 1. Doble confirmación simultánea del mismo pedido.
  await setStock(5)
  const o1 = await createOrder(productId, 2, date)
  const id1 = await orderId(o1.rows[0].folio)
  const twice = await Promise.all([1, 2, 3].map(() => as('admin', 'select public.confirm_order($1)', [id1])))
  check('1. tres confirmaciones simultáneas no fallan', twice.every((r) => r.ok), twice.map((r) => r.error).filter(Boolean).join(' | '))
  check('1. el stock se descuenta una sola vez (5 → 3)', (await stock()) === 3, String(await stock()))
  const mov1 = (await admin.query("select count(*)::int n from public.inventory_movements where order_id = $1 and reason = 'order_confirmed'", [id1])).rows[0].n
  check('1. un solo movimiento de confirmación', mov1 === 1, String(mov1))

  // 2. Confirmar y cancelar a la vez: el resultado final siempre es coherente.
  await setStock(5)
  const o2 = await createOrder(productId, 2, date)
  const id2 = await orderId(o2.rows[0].folio)
  await Promise.all([
    as('admin', 'select public.confirm_order($1)', [id2]),
    as('admin', "select public.cancel_order($1, 'Carrera de prueba')", [id2]),
  ])
  const s2 = (await admin.query('select status, stock_deducted from public.orders where id = $1', [id2])).rows[0]
  const net2 = (await admin.query('select coalesce(sum(delta), 0)::int n from public.inventory_movements where order_id = $1', [id2])).rows[0].n
  const st2 = await stock()
  check('2. confirmar/cancelar simultáneos: termina cancelado', s2.status === 'cancelled', s2.status)
  check('2. el inventario queda como al inicio (movimientos netos 0)', st2 === 5 && net2 === 0, `stock=${st2} neto=${net2}`)

  // 3. Dos pedidos distintos se confirman a la vez por la última unidad.
  await setStock(1)
  const a = await createOrder(productId, 1, date)
  const b = await createOrder(productId, 1, date)
  const [ra, rb] = await Promise.all([
    as('admin', 'select public.confirm_order($1)', [await orderId(a.rows[0].folio)]),
    as('admin', 'select public.confirm_order($1)', [await orderId(b.rows[0].folio)]),
  ])
  check('3. última unidad: exactamente una confirmación gana', [ra, rb].filter((r) => r.ok).length === 1,
    [ra, rb].map((r) => r.error ?? 'ok').join(' | '))
  check('3. la otra recibe «Existencias insuficientes»', [ra, rb].some((r) => /Existencias insuficientes/.test(r.error ?? '')))
  check('3. el stock nunca queda negativo', (await stock()) === 0, String(await stock()))

  // 4. Ajuste de inventario negativo y confirmación a la vez: nunca stock negativo.
  await setStock(3)
  const c4 = await createOrder(productId, 2, date)
  const id4 = await orderId(c4.rows[0].folio)
  const [conf4, adj4] = await Promise.all([
    as('admin', 'select public.confirm_order($1)', [id4]),
    as('admin', "select public.adjust_stock($1, -2, 'waste', 'carrera de prueba')", [productId]),
  ])
  const st4 = await stock()
  check('4. confirmación y merma simultáneas: una de las dos se rechaza', [conf4, adj4].filter((r) => r.ok).length === 1,
    [conf4, adj4].map((r) => r.error ?? 'ok').join(' | '))
  check('4. el stock queda en 1 y nunca negativo', st4 === 1, String(st4))

  // 5. Capacidad 1: varios pedidos bajo pedido distintos para el mismo día.
  const cake = (await admin.query("select id from public.products where sku = 'PAS-002'")).rows[0].id
  await admin.query('update public.store_settings set daily_capacity = 1')
  const capDate = await day(20)
  const race5 = await Promise.all([1, 2, 3, 4].map(() => createOrder(cake, 1, capDate)))
  check('5. capacidad 1 con 4 pedidos simultáneos: se crea exactamente uno', race5.filter((r) => r.ok).length === 1,
    race5.map((r) => (r.ok ? 'ok' : r.error)).join(' | '))
  check('5. los demás reciben «Ya no hay cupo»', race5.filter((r) => !r.ok).every((r) => /Ya no hay cupo/.test(r.error)))

  // 6. Envíos gemelos (misma clave) por el último cupo: mismo pedido, sin error.
  const twinDate = await day(21)
  const key = crypto.randomUUID()
  const twins = await Promise.all([1, 2, 3].map(() => createOrder(cake, 1, twinDate, key)))
  const folios = new Set(twins.map((t) => t.rows?.[0]?.folio))
  check('6. gemelos simultáneos por el último cupo: ninguno falla', twins.every((t) => t.ok), twins.map((t) => t.error).filter(Boolean).join(' | '))
  check('6. todos reciben el mismo folio', folios.size === 1 && !folios.has(undefined), [...folios].join(','))
  await admin.query('update public.store_settings set daily_capacity = $1', [settingsBefore.daily_capacity])

  // 7. Reembolsos simultáneos que juntos superan lo pagado.
  await setStock(5)
  const o7 = await createOrder(productId, 1, date)
  const id7 = await orderId(o7.rows[0].folio)
  await as('admin', "insert into public.payments (order_id, amount_cents, method) values ($1, 1000, 'cash')", [id7])
  const refunds = await Promise.all([1, 2].map(() =>
    as('admin', "insert into public.payments (order_id, amount_cents, method, is_refund) values ($1, 700, 'cash', true)", [id7])))
  check('7. dos reembolsos de 700 sobre 1000 pagados: solo uno entra', refunds.filter((r) => r.ok).length === 1,
    refunds.map((r) => r.error ?? 'ok').join(' | '))
  const net7 = (await admin.query('select sum(case when is_refund then -amount_cents else amount_cents end)::int n from public.payments where order_id = $1', [id7])).rows[0].n
  check('7. lo pagado nunca queda negativo', net7 === 300, String(net7))
} catch (e) {
  failed++
  console.error('Error inesperado:', e.message)
} finally {
  // Limpieza: los disparadores de solo inserción se desactivan únicamente dentro de esta transacción.
  try {
    await admin.query('begin')
    await admin.query('update public.store_settings set daily_capacity = $1', [settingsBefore.daily_capacity])
    const ids = (await admin.query('select id from public.orders where customer_name = $1', [CUSTOMER])).rows.map((r) => r.id)
    await admin.query('alter table public.inventory_movements disable trigger inventory_movements_append_only')
    await admin.query('alter table public.payments disable trigger payments_append_only')
    if (ids.length) {
      await admin.query('delete from public.payments where order_id = any($1)', [ids])
      await admin.query('delete from public.inventory_movements where order_id = any($1)', [ids])
      await admin.query('delete from public.orders where id = any($1)', [ids])
    }
    if (productId) {
      await admin.query('delete from public.inventory_movements where product_id = $1', [productId])
      await admin.query('delete from public.products where id = $1', [productId])
    }
    await admin.query('alter table public.inventory_movements enable trigger inventory_movements_append_only')
    await admin.query('alter table public.payments enable trigger payments_append_only')
    await admin.query('commit')
  } catch (e) {
    await admin.query('rollback').catch(() => {})
    failed++
    console.error('Error en la limpieza:', e.message)
  }
  const left = (await admin.query(`select
      (select count(*) from public.orders where customer_name = $1)::int pedidos,
      (select count(*) from public.products where sku = 'TEST-CONC')::int productos,
      (select count(*) from pg_trigger where tgname in ('inventory_movements_append_only', 'payments_append_only') and tgenabled = 'O')::int disparadores`,
    [CUSTOMER])).rows[0]
  console.log(`\nLimpieza: ${JSON.stringify(left)} (esperado: 0 pedidos, 0 productos, 2 disparadores activos)`)
  if (left.pedidos || left.productos || left.disparadores !== 2) failed++
  await admin.end()
}

console.log(failed ? `\n${failed} fallo(s)` : '\nTodas las pruebas de concurrencia pasaron')
process.exit(failed ? 1 : 0)
