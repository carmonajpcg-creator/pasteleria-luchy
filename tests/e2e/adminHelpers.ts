import type { Page, Route } from '@playwright/test'
import { fixtures } from '../fixtures/catalogo'

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, HEAD, OPTIONS',
  'access-control-expose-headers': 'content-range',
}

export const ADMIN = { email: 'admin@test.local', password: 'clave-correcta', id: 'u-admin' }
export const NO_ROLE = { email: 'sinrol@test.local', password: 'clave-correcta', id: 'u-sinrol' }

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwtFor = (sub: string) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: 4102444800 })}.firma`

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const send = (route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) =>
  route.fulfill({
    status,
    headers: { ...cors, ...headers },
    contentType: 'application/json',
    body: body === undefined ? '' : JSON.stringify(body),
  })
const fail = (route: Route, code: string, message: string, status = 400) => send(route, { code, message, details: null, hint: null }, status)

export interface AdminState {
  categories: Json[]
  products: Json[]
  orders: Json[]
  payments: Json[]
  movements: Json[]
  images: Json[]
  settings: Json
}

/** Datos ficticios y deterministas del panel (no son productos ni clientes reales). */
function initialState(): AdminState {
  const stock: Record<string, number> = { p3: 12, p4: 2, p5: 8 }
  const products = fixtures.products.map((p) => ({
    id: p.id, category_id: p.category_id, sku: p.sku, slug: p.slug, name: p.name, description: p.description,
    price_cents: p.price_cents, allergens: p.allergens, allergens_verified: p.allergens_verified,
    lead_time_hours: p.lead_time_hours, fulfillment_type: p.fulfillment_type,
    stock_quantity: stock[p.id] ?? 0, low_stock_threshold: 3, featured: p.featured, active: true,
    allows_customization: p.allows_customization, customization_hint: p.customization_hint,
  }))
  const item = (n: number, product: Json, quantity: number, customization: string | null = null) => ({
    id: `i${n}`, sku: product.sku, name: product.name, unit_price_cents: product.price_cents, quantity,
    customization, line_total_cents: product.price_cents * quantity,
  })
  const pastel = products[0]!
  const cupcake = products[2]!
  return {
    categories: fixtures.categories.map((c) => ({ ...c, active: true })),
    products,
    orders: [
      {
        id: 'o1', folio: 'L-ADMIN01', status: 'pending_contact', payment_status: 'unpaid', customer_name: 'Ana López',
        customer_phone: '5512345678', customer_email: null, notes: 'Sin nueces', fulfillment: 'pickup',
        requested_date: '2026-11-20', total_cents: 9000, stock_deducted: false, created_at: '2026-10-19T15:00:00Z',
        expires_at: '2026-10-21T15:00:00Z', confirmed_at: null, cancelled_at: null, cancel_reason: null,
        order_items: [item(1, cupcake, 2)],
      },
      {
        id: 'o2', folio: 'L-ADMIN02', status: 'confirmed', payment_status: 'unpaid', customer_name: 'Beto Ruiz',
        customer_phone: '5598765432', customer_email: 'beto@ejemplo.mx', notes: null, fulfillment: 'delivery',
        requested_date: '2026-11-22', total_cents: 60000, stock_deducted: true, created_at: '2026-10-18T10:00:00Z',
        expires_at: '2026-10-20T10:00:00Z', confirmed_at: '2026-10-18T12:00:00Z', cancelled_at: null, cancel_reason: null,
        order_items: [item(2, pastel, 1, 'Feliz cumpleaños')],
      },
    ],
    payments: [],
    movements: [],
    images: [],
    settings: {
      ...fixtures.settings, order_expiry_hours: 48, timezone: 'America/Matamoros',
      closed_weekdays: [], pickup_closed_weekdays: [], closed_dates: [], daily_capacity: null, min_lead_hours: 0,
    },
  }
}

export interface AdminCalls {
  confirmOrder: string[]
  cancelOrder: { id: string; reason: string }[]
  advanceOrder: { id: string; to: string }[]
  adjustStock: Json[]
  payments: Json[]
  productWrites: { method: string; body: Json }[]
  categoryWrites: { method: string; body: Json | null }[]
  settingsPatches: Json[]
  uploads: string[]
  removed: string[]
  /** Todas las peticiones que llevaban una sesión de usuario del panel. */
  authed: string[]
}

export interface AdminOptions {
  /** Hace que la subida de imágenes al almacenamiento falle. */
  uploadFails?: boolean
  /** Retraso de confirm_order, para probar dobles clics. */
  confirmDelayMs?: number
  /** Pedidos entregados adicionales, para probar el tope de la bandeja. */
  extraOrders?: number
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

/**
 * Simula Auth + REST + RPC + Storage del panel con estado en memoria. Se registra DESPUÉS de
 * mockSupabase: las peticiones sin sesión de panel pasan a la simulación pública con route.fallback().
 */
export async function mockAdmin(page: Page, options: AdminOptions = {}) {
  const state = initialState()
  const calls: AdminCalls = {
    confirmOrder: [], cancelOrder: [], advanceOrder: [], adjustStock: [], payments: [], productWrites: [],
    categoryWrites: [], settingsPatches: [], uploads: [], removed: [], authed: [],
  }
  let nextId = 100
  for (let n = 0; n < (options.extraOrders ?? 0); n++) {
    state.orders.push({
      ...state.orders[1]!, id: `x${n}`, folio: `L-HIST${String(n).padStart(3, '0')}`, status: 'delivered',
      created_at: `2026-01-01T00:00:${String(n % 60).padStart(2, '0')}Z`,
    })
  }

  // ---- Auth (GoTrue) ----
  await page.route('**/auth/v1/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const path = new URL(req.url()).pathname
    if (path.endsWith('/token')) {
      const { email, password } = req.postDataJSON() as { email: string; password: string }
      const user = [ADMIN, NO_ROLE].find((u) => u.email === email && u.password === password)
      if (!user) return send(route, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400)
      return send(route, {
        access_token: jwtFor(user.id), token_type: 'bearer', expires_in: 3600, refresh_token: 'refresh-1',
        user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
      })
    }
    if (path.endsWith('/logout')) return route.fulfill({ status: 204, headers: cors })
    return send(route, { message: 'no simulado' }, 404)
  })

  // ---- Storage ----
  await page.route('**/storage/v1/object/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const path = new URL(req.url()).pathname
    if (req.method() === 'GET') return route.fulfill({ status: 200, headers: cors, contentType: 'image/png', body: PNG })
    if (req.method() === 'POST') {
      if (options.uploadFails) return send(route, { message: 'fallo simulado' }, 500)
      calls.uploads.push(path)
      return send(route, { Key: path.replace('/storage/v1/object/', '') })
    }
    if (req.method() === 'DELETE') {
      const body = req.postDataJSON() as { prefixes?: string[] } | null
      calls.removed.push(...(body?.prefixes ?? [path]))
      return send(route, [])
    }
    return route.fallback()
  })

  // ---- REST / RPC ----
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })

    const bearer = (req.headers()['authorization'] ?? '').replace('Bearer ', '')
    const sub = bearer.split('.')[1] ? (JSON.parse(Buffer.from(bearer.split('.')[1]!, 'base64url').toString()) as { sub?: string }).sub : undefined
    // Sin sesión del panel → comportamiento público (o rechazo si es una tabla privada).
    if (!sub) return route.fallback()
    const isAdmin = sub === ADMIN.id
    calls.authed.push(`${req.method()} ${new URL(req.url()).pathname.split('/rest/v1/')[1]}`)

    const url = new URL(req.url())
    const table = url.pathname.split('/rest/v1/')[1]!.replace(/^rpc\//, '')
    const isRpc = url.pathname.includes('/rpc/')
    const q = (name: string) => url.searchParams.get(name)?.replace(/^(eq|ilike)\./, '')
    const body = (req.method() === 'POST' || req.method() === 'PATCH' ? req.postDataJSON() : null) as Json | null
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')

    // Un usuario autenticado sin rol: RLS le devuelve vacío y las RPC protegidas fallan.
    if (!isAdmin) {
      if (table === 'profiles') return send(route, [])
      if (isRpc) return fail(route, '42501', 'No autorizado', 403)
      return table === 'store_settings' || table === 'catalog_products' || table === 'categories' || table === 'product_images'
        ? route.fallback()
        : send(route, [])
    }

    const byId = (rows: Json[]) => rows.find((r) => r.id === q('id'))
    const orderSummary = (o: Json) => {
      const { order_items, ...rest } = o
      void order_items
      return rest
    }
    const recomputePayment = (order: Json) => {
      const paid = state.payments.filter((p) => p.order_id === order.id)
      const net = paid.reduce((s, p) => s + (p.is_refund ? -p.amount_cents : p.amount_cents), 0)
      const refunds = paid.filter((p) => p.is_refund).length
      order.payment_status = net === 0 ? (refunds ? 'refunded' : 'unpaid') : net < order.total_cents ? 'partial' : 'paid'
    }

    switch (table) {
      case 'profiles':
        return send(route, [{ role: 'admin' }])

      case 'admin_dashboard': {
        const byStatus: Record<string, number> = {}
        for (const o of state.orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
        const sales = state.orders.filter((o) => ['confirmed', 'in_preparation', 'ready', 'delivered'].includes(o.status))
        return send(route, {
          orders_by_status: byStatus,
          confirmed_sales_cents: sales.reduce((s, o) => s + o.total_cents, 0),
          paid_cents: state.payments.reduce((s, p) => s + (p.is_refund ? -p.amount_cents : p.amount_cents), 0),
          low_stock: state.products
            .filter((p) => p.active && p.fulfillment_type === 'stock' && p.stock_quantity <= p.low_stock_threshold)
            .map((p) => ({ id: p.id, sku: p.sku, name: p.name, stock_quantity: p.stock_quantity, low_stock_threshold: p.low_stock_threshold })),
        })
      }

      case 'orders': {
        const select = q('select') ?? ''
        if (q('id')) {
          const order = byId(state.orders)
          if (!order) return send(route, [])
          return send(route, [{ ...order, payments: state.payments.filter((p) => p.order_id === order.id) }])
        }
        void select
        let rows = state.orders
        if (q('status')) rows = rows.filter((o) => o.status === q('status'))
        const folio = url.searchParams.get('folio')?.replace(/^ilike\./, '').replaceAll('%', '').toLowerCase()
        if (folio) rows = rows.filter((o) => o.folio.toLowerCase().includes(folio))
        const limit = Number(url.searchParams.get('limit') ?? Infinity)
        return send(route, rows.slice(0, limit).map(orderSummary))
      }

      case 'admin_capacity': {
        const s = state.settings
        const days = Array.from({ length: (body!.p_days as number) ?? 14 }, (_, i) => {
          const d = new Date()
          d.setUTCDate(d.getUTCDate() + i)
          const day = d.toISOString().slice(0, 10)
          const closed = (s.closed_dates as string[]).includes(day) || (s.closed_weekdays as number[]).includes(d.getUTCDay())
          const orders = state.orders.filter((o) => o.requested_date === day && o.status !== 'cancelled').length
          const pickupClosed = (s.pickup_closed_weekdays as number[]).includes(d.getUTCDay())
          return { day, orders, closed, pickup_closed: pickupClosed }
        })
        return send(route, { capacity: s.daily_capacity, days })
      }

      case 'admin_day_capacity': {
        const day = body!.p_day as string
        // Como capacity_used: los pendientes caducados no ocupan lugar.
        const orders = state.orders.filter(
          (o) => o.requested_date === day && o.status !== 'cancelled'
            && (o.status !== 'pending_contact' || new Date(o.expires_at).getTime() > Date.now()),
        ).length
        return send(route, { capacity: state.settings.daily_capacity, orders })
      }

      case 'confirm_order': {
        if (options.confirmDelayMs) await new Promise((r) => setTimeout(r, options.confirmDelayMs))
        const id = body!.p_order_id as string
        calls.confirmOrder.push(id)
        const order = state.orders.find((o) => o.id === id)
        if (!order) return fail(route, 'P0002', 'Pedido no encontrado', 404)
        if (order.status !== 'pending_contact') return send(route, order.status) // idempotente
        for (const it of order.order_items) {
          const product = state.products.find((p) => p.sku === it.sku)!
          if (product.fulfillment_type !== 'stock') continue
          if (product.stock_quantity < it.quantity) return fail(route, '22023', `Existencias insuficientes de ${product.name}`)
          product.stock_quantity -= it.quantity
          state.movements.push({ id: `m${nextId++}`, product_id: product.id, order_id: id, delta: -it.quantity, reason: 'order_confirmed', note: null, created_at: new Date().toISOString(), products: { name: product.name, sku: product.sku } })
        }
        Object.assign(order, { status: 'confirmed', stock_deducted: true, confirmed_at: new Date().toISOString() })
        return send(route, 'confirmed')
      }

      case 'advance_order': {
        const order = state.orders.find((o) => o.id === body!.p_order_id)!
        const next = { confirmed: 'in_preparation', in_preparation: 'ready', ready: 'delivered' }[order.status as string]
        calls.advanceOrder.push({ id: order.id, to: body!.p_to })
        if (next !== body!.p_to) return fail(route, '22023', `Transición no permitida: ${order.status} → ${body!.p_to}`)
        order.status = next
        return send(route, next)
      }

      case 'cancel_order': {
        const order = state.orders.find((o) => o.id === body!.p_order_id)!
        calls.cancelOrder.push({ id: order.id, reason: body!.p_reason })
        if (order.stock_deducted) {
          for (const it of order.order_items) {
            const product = state.products.find((p) => p.sku === it.sku)!
            if (product.fulfillment_type !== 'stock') continue
            product.stock_quantity += it.quantity
            state.movements.push({ id: `m${nextId++}`, product_id: product.id, order_id: order.id, delta: it.quantity, reason: 'order_cancelled', note: body!.p_reason, created_at: new Date().toISOString(), products: { name: product.name, sku: product.sku } })
          }
        }
        Object.assign(order, { status: 'cancelled', stock_deducted: false, cancel_reason: body!.p_reason })
        return send(route, 'cancelled')
      }

      case 'payments': {
        if (req.method() !== 'POST') return send(route, [])
        calls.payments.push(body!)
        const order = state.orders.find((o) => o.id === body!.order_id)!
        const net = state.payments.filter((p) => p.order_id === order.id).reduce((s, p) => s + (p.is_refund ? -p.amount_cents : p.amount_cents), 0)
        if (body!.is_refund && body!.amount_cents > net) return fail(route, 'P0001', 'Los reembolsos superan lo pagado')
        state.payments.push({ id: `pay${nextId++}`, paid_at: new Date().toISOString(), ...body })
        recomputePayment(order)
        return route.fulfill({ status: 201, headers: cors })
      }

      case 'inventory_movements': {
        let rows = state.movements
        if (q('order_id')) rows = rows.filter((m) => m.order_id === q('order_id'))
        if (q('product_id')) rows = rows.filter((m) => m.product_id === q('product_id'))
        return send(route, rows)
      }

      case 'adjust_stock': {
        calls.adjustStock.push(body!)
        const product = byIdRpc(state.products, body!.p_product_id)
        if (!product || product.fulfillment_type !== 'stock') return fail(route, '22023', 'Producto no encontrado o sin inventario físico')
        if (product.stock_quantity + body!.p_delta < 0) return fail(route, '23514', 'new row violates check constraint "products_stock_quantity_check"')
        product.stock_quantity += body!.p_delta
        state.movements.push({ id: `m${nextId++}`, product_id: product.id, order_id: null, delta: body!.p_delta, reason: body!.p_reason, note: body!.p_note, created_at: new Date().toISOString() })
        return send(route, product.stock_quantity)
      }

      case 'products': {
        if (req.method() === 'HEAD') {
          const n = state.products.filter((p) => p.fulfillment_type === q('fulfillment_type')).length
          return route.fulfill({ status: 200, headers: { ...cors, 'content-range': `*/${n}` } })
        }
        if (req.method() === 'POST') {
          calls.productWrites.push({ method: 'POST', body: body! })
          if (state.products.some((p) => p.sku === body!.sku)) return fail(route, '23505', 'duplicate key value violates unique constraint "products_sku_key"', 409)
          const created = { id: `np${nextId++}`, stock_quantity: 0, ...body }
          state.products.push(created)
          return wantsObject ? send(route, { id: created.id }, 201) : send(route, [{ id: created.id }], 201)
        }
        if (req.method() === 'PATCH') {
          calls.productWrites.push({ method: 'PATCH', body: body! })
          Object.assign(byId(state.products) ?? {}, body)
          return route.fulfill({ status: 204, headers: cors })
        }
        if (q('id')) return send(route, state.products.filter((p) => p.id === q('id')))
        let rows = state.products
        if (q('fulfillment_type')) rows = rows.filter((p) => p.fulfillment_type === q('fulfillment_type'))
        return send(route, rows)
      }

      case 'categories': {
        if (req.method() === 'POST') {
          calls.categoryWrites.push({ method: 'POST', body })
          state.categories.push({ id: `nc${nextId++}`, ...body })
          return route.fulfill({ status: 201, headers: cors })
        }
        if (req.method() === 'PATCH') {
          calls.categoryWrites.push({ method: 'PATCH', body })
          Object.assign(byId(state.categories) ?? {}, body)
          return route.fulfill({ status: 204, headers: cors })
        }
        if (req.method() === 'DELETE') {
          calls.categoryWrites.push({ method: 'DELETE', body: null })
          if (state.products.some((p) => p.category_id === q('id'))) return fail(route, '23503', 'update or delete on table "categories" violates foreign key constraint', 409)
          state.categories = state.categories.filter((c) => c.id !== q('id'))
          return route.fulfill({ status: 204, headers: cors })
        }
        // Como PostgREST: respeta ?active=eq.true (la tienda pública lo envía; RLS al admin le daría todas).
        const onlyActive = url.searchParams.get('active') === 'eq.true'
        return send(route, onlyActive ? state.categories.filter((c) => c.active) : state.categories)
      }

      case 'product_images': {
        if (req.method() === 'POST') {
          state.images.push({ id: `img${nextId++}`, ...body })
          return route.fulfill({ status: 201, headers: cors })
        }
        if (req.method() === 'PATCH') {
          Object.assign(byId(state.images) ?? {}, body)
          return route.fulfill({ status: 204, headers: cors })
        }
        if (req.method() === 'DELETE') {
          state.images = state.images.filter((i) => i.id !== q('id'))
          return route.fulfill({ status: 204, headers: cors })
        }
        return send(route, state.images.filter((i) => i.product_id === q('product_id')))
      }

      case 'store_settings': {
        if (req.method() === 'PATCH') {
          calls.settingsPatches.push(body!)
          Object.assign(state.settings, body)
          return route.fulfill({ status: 204, headers: cors })
        }
        return send(route, wantsObject ? state.settings : [state.settings])
      }

      default:
        return fail(route, 'PGRST205', `Tabla no simulada: ${table}`, 404)
    }
  })

  return { state, calls }
}

function byIdRpc(rows: Json[], id: string) {
  return rows.find((r) => r.id === id)
}
