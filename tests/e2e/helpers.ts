import type { Page, Route } from '@playwright/test'
import { fixtures } from '../fixtures/catalogo'

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })

export interface CreateOrderCall {
  idempotencyKey: string
  body: Record<string, unknown>
}

interface Options {
  productsStatus?: number
  /** Las primeras N llamadas a create_order fallan con 500 (caída de red del servidor). */
  createOrderFailures?: number
  /** Error de negocio de create_order (SQLSTATE y mensaje en español, como la BD). */
  createOrderError?: { code: string; message: string }
  /** Retraso de create_order para probar dobles clics. */
  createOrderDelayMs?: number
  /** Fechas (YYYY-MM-DD) cerradas o sin cupo, como las informaría get_availability. */
  closedDates?: string[]
  fullDates?: string[]
  /** Estado HTTP de get_availability (para simular que no se pudo consultar). */
  availabilityStatus?: number
}

// Fecha UTC del instante «ahora + horas» (la zona de la tienda en las fixtures es UTC).
const utcDate = (hoursAhead = 0) => new Date(Date.now() + hoursAhead * 3_600_000).toISOString().slice(0, 10)

interface StoredOrder {
  folio: string
  token: string
  publicOrder: Record<string, unknown>
}

// Simula la API REST de Supabase (PostgREST + RPC): las pruebas E2E no tocan la nube ni envían nada.
// El build de pruebas apunta a http://supabase.test (ver playwright.config.ts).
export async function mockSupabase(page: Page, options: Options = {}) {
  const createOrderCalls: CreateOrderCall[] = []
  const orders = new Map<string, StoredOrder>() // por clave de idempotencia
  let failuresLeft = options.createOrderFailures ?? 0

  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })

    const url = new URL(req.url())
    const table = url.pathname.split('/').pop()
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')

    switch (table) {
      case 'catalog_products': {
        if (options.productsStatus) return json(route, { message: 'error simulado' }, options.productsStatus)
        // supabase-js: maybeSingle() pide un array y toma el primer elemento; single() pide un objeto.
        const slug = url.searchParams.get('slug')?.replace('eq.', '')
        const rows = slug ? fixtures.products.filter((p) => p.slug === slug) : fixtures.products
        return json(route, rows)
      }
      case 'categories':
        return json(route, fixtures.categories)
      case 'product_images':
        return json(route, [])
      case 'store_settings':
        return json(route, wantsObject ? fixtures.settings : [fixtures.settings])

      case 'get_availability': {
        if (options.availabilityStatus) return json(route, { message: 'error simulado' }, options.availabilityStatus)
        const { p_from, p_to, p_lead_hours } = req.postDataJSON() as { p_from: string; p_to: string; p_lead_hours: number }
        const today = utcDate()
        const minDay = utcDate(p_lead_hours ?? 0)
        const out: { day: string; available: boolean; reason: string | null }[] = []
        for (let d = new Date(`${p_from}T00:00:00Z`); d <= new Date(`${p_to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
          const day = d.toISOString().slice(0, 10)
          const reason = day < today ? 'past' : day < minDay ? 'lead'
            : options.closedDates?.includes(day) ? 'closed' : options.fullDates?.includes(day) ? 'full' : null
          out.push({ day, available: reason === null, reason })
        }
        return json(route, out)
      }

      case 'create_order': {
        const body = req.postDataJSON() as Record<string, unknown>
        const key = String(body.p_idempotency_key)
        createOrderCalls.push({ idempotencyKey: key, body })
        if (options.createOrderDelayMs) await new Promise((r) => setTimeout(r, options.createOrderDelayMs))
        if (failuresLeft > 0) {
          failuresLeft--
          return json(route, { message: 'Internal error' }, 500)
        }
        if (options.createOrderError) {
          return json(route, { ...options.createOrderError, details: null, hint: null }, 400)
        }
        // Idempotencia simulada: la misma clave devuelve el mismo pedido.
        let stored = orders.get(key)
        if (!stored) {
          const lines = (body.p_items as { product_id: string; quantity: number }[]).map((i) => {
            const p = fixtures.products.find((x) => x.id === i.product_id)!
            return { name: p.name, quantity: i.quantity, unit_price_cents: p.price_cents, line_total_cents: p.price_cents * i.quantity }
          })
          const total = lines.reduce((s, l) => s + l.line_total_cents, 0)
          const n = orders.size + 1
          stored = {
            folio: `L-TEST00${n}`,
            token: `token-${n}`,
            publicOrder: {
              folio: `L-TEST00${n}`, status: 'pending_contact', payment_status: 'unpaid',
              fulfillment: body.p_fulfillment, requested_date: body.p_requested_date,
              total_cents: total, created_at: new Date().toISOString(), items: lines,
            },
          }
          orders.set(key, stored)
        }
        return json(route, [
          { folio: stored.folio, public_token: stored.token, total_cents: stored.publicOrder.total_cents, status: 'pending_contact' },
        ])
      }
      case 'get_order_public': {
        const { p_folio, p_token } = req.postDataJSON() as { p_folio: string; p_token: string }
        const found = [...orders.values()].find((o) => o.folio === p_folio && o.token === p_token)
        return json(route, found?.publicOrder ?? null)
      }
      default:
        return json(route, { message: `Ruta no simulada: ${table}` }, 404)
    }
  })

  return { createOrderCalls }
}

/** Impide que cualquier navegación a WhatsApp salga a internet; cuenta las aperturas. */
export async function stubWhatsApp(page: Page) {
  const opened: string[] = []
  await page.context().route('https://wa.me/**', (route) => {
    opened.push(route.request().url())
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>WhatsApp (simulado)</h1>' })
  })
  return { opened }
}

/** Fecha UTC YYYY-MM-DD a N días de hoy (la zona de la tienda en las fixtures es UTC). */
export function utcDaysFromNow(days: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Fecha local YYYY-MM-DD a N días de hoy, para el campo de fecha solicitada. */
export function isoDaysFromNow(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
