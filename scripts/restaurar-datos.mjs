// Restaura un respaldo de scripts/backup-datos.mjs en una base VACÍA (recuperación ante desastre).
//   LUCHY_RESTAURAR=SI SUPABASE_DB_URL=<destino> node scripts/restaurar-datos.mjs backups/luchy-....json
// Nunca sobrescribe: si alguna tabla del destino ya tiene filas, se detiene sin cambiar nada.
// Todo ocurre en una sola transacción: o se restaura todo o no se cambia nada.
// Requisito previo: las migraciones ya aplicadas y los administradores recreados con el MISMO id que
// tenían (ver docs/publicacion.md), porque pagos y movimientos guardan quién los registró.
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const [, , archivo] = process.argv
if (process.env.LUCHY_RESTAURAR !== 'SI' || !process.env.SUPABASE_DB_URL || !archivo) {
  console.error('Uso: LUCHY_RESTAURAR=SI SUPABASE_DB_URL=<destino> node scripts/restaurar-datos.mjs <respaldo.json>')
  process.exit(2)
}

const TABLAS = ['categories', 'products', 'product_images', 'orders', 'order_items', 'payments', 'inventory_movements']
const respaldo = JSON.parse(await readFile(archivo, 'utf8'))
if (respaldo.formato !== 1) {
  console.error(`Formato de respaldo no soportado: ${respaldo.formato}`)
  process.exit(2)
}

const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
let escritas = false
try {
  // 1. El destino debe estar vacío.
  for (const t of TABLAS) {
    const n = (await db.query(`select count(*)::int n from public.${t}`)).rows[0].n
    if (n > 0) throw new Error(`El destino NO está vacío: ${t} tiene ${n} filas. No se restaura nada.`)
  }
  // 2. Los administradores referenciados deben existir con el mismo id.
  const ids = new Set()
  for (const p of respaldo.datos.payments) ids.add(p.recorded_by)
  for (const m of respaldo.datos.inventory_movements) if (m.actor) ids.add(m.actor)
  for (const id of ids) {
    const ok = (await db.query('select 1 from auth.users where id = $1', [id])).rowCount
    if (!ok) throw new Error(`Falta el usuario ${id} en auth.users. Recréalo con ese mismo id antes de restaurar (docs/publicacion.md).`)
  }

  await db.query('begin')
  escritas = true
  for (const t of TABLAS) {
    const filas = respaldo.datos[t]
    if (filas.length === 0) continue
    // Columnas generadas (line_total_cents) se recalculan solas: no se insertan.
    const generadas = new Set(
      (await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='ALWAYS'`, [t]))
        .rows.map((r) => r.column_name),
    )
    const columnas = Object.keys(filas[0]).filter((c) => !generadas.has(c))
    const sql = `insert into public.${t} (${columnas.map((c) => `"${c}"`).join(',')})
                 select ${columnas.map((c) => `x."${c}"`).join(',')}
                   from json_populate_recordset(null::public.${t}, $1::json) x`
    await db.query(sql, [JSON.stringify(filas)])
  }
  // La configuración es una sola fila que las migraciones ya crearon: se actualiza.
  const cols = Object.keys(respaldo.datos.store_settings).filter((c) => c !== 'id' && c !== 'updated_at')
  await db.query(
    `update public.store_settings s set ${cols.map((c) => `"${c}" = x."${c}"`).join(', ')}
       from json_populate_record(null::public.store_settings, $1::json) x`,
    [JSON.stringify(respaldo.datos.store_settings)],
  )
  await db.query('commit')

  // 3. Verificación: mismas cantidades que el respaldo.
  let bien = true
  for (const t of TABLAS) {
    const n = (await db.query(`select count(*)::int n from public.${t}`)).rows[0].n
    const esperado = respaldo.datos[t].length
    console.log(`${n === esperado ? 'ok    ' : 'FALLA '} ${t}: ${n} de ${esperado}`)
    if (n !== esperado) bien = false
  }
  console.log(bien ? '\nRestauración completa.' : '\nLas cantidades no coinciden.')
  process.exit(bien ? 0 : 1)
} catch (e) {
  if (escritas) await db.query('rollback').catch(() => {})
  console.error(`\nNo se restauró nada: ${e.message}`)
  process.exit(1)
} finally {
  await db.end()
}
