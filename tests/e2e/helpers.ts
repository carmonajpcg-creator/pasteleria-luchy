import type { Page, Route } from '@playwright/test'
import { fixtures } from '../fixtures/catalogo'

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })

// Simula la API REST de Supabase (PostgREST): las pruebas E2E no tocan la nube ni envían nada.
// El build de pruebas apunta a http://supabase.test (ver playwright.config.ts).
export async function mockSupabase(page: Page, overrides: { productsStatus?: number } = {}) {
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })

    const url = new URL(req.url())
    const table = url.pathname.split('/').pop()
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')

    switch (table) {
      case 'catalog_products': {
        if (overrides.productsStatus) {
          return json(route, { message: 'error simulado' }, overrides.productsStatus)
        }
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
        // single() pide un objeto; con cualquier otra cabecera devolvemos una lista.
        return json(route, wantsObject ? fixtures.settings : [fixtures.settings])
      default:
        return json(route, { message: `Ruta no simulada: ${table}` }, 404)
    }
  })
}
