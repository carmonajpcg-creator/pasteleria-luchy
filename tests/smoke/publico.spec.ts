import { expect, test, type Page } from '@playwright/test'

// Humo de solo lectura sobre el sitio publicado: rutas directas, recursos, CSP, datos de contacto y
// WhatsApp (se verifica el enlace; nunca se abre ni se envía nada).

const rutas: [string, string][] = [
  ['#/', 'Pastelería Luchy'],
  ['#/catalogo', 'Catálogo'],
  ['#/carrito', 'Carrito'],
  ['#/checkout', 'Checkout'],
  ['#/nosotros', 'Nosotros'],
  ['#/contacto', 'Contacto'],
  ['#/privacidad', 'Aviso de privacidad'],
  ['#/condiciones', 'Condiciones de pedido'],
  ['#/pedido/L-NOEXISTE', 'Seguimiento de pedido'],
  ['#/admin/login', 'Acceso administrador'],
  ['#/admin', 'Acceso administrador'], // sin sesión → login
  ['#/admin/pedidos', 'Acceso administrador'],
  ['#/ruta-que-no-existe', 'Página no encontrada'],
]

function vigilar(page: Page) {
  const problemas: string[] = []
  page.on('console', (m) => m.type() === 'error' && problemas.push(`consola: ${m.text()}`))
  page.on('pageerror', (e) => problemas.push(`excepción: ${e.message}`))
  page.on('response', (r) => r.status() >= 400 && problemas.push(`HTTP ${r.status()} ${r.url()}`))
  page.on('requestfailed', (r) => problemas.push(`falló: ${r.url()} (${r.failure()?.errorText})`))
  return problemas
}

for (const [ruta, titulo] of rutas) {
  test(`enlace directo ${ruta} carga, y recargar no lo rompe`, async ({ page }) => {
    const problemas = vigilar(page)
    await page.goto(ruta)
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
    expect(problemas).toEqual([])
  })
}

test('todos los recursos del sitio (JS, CSS, fuentes) se sirven y respetan la base de la URL', async ({ page, baseURL }) => {
  const recursos: { url: string; status: number }[] = []
  page.on('response', (r) => recursos.push({ url: r.url(), status: r.status() }))
  await page.goto('')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')
  const propios = recursos.filter((r) => r.url.startsWith(baseURL!))
  expect(propios.some((r) => r.url.endsWith('.js'))).toBe(true)
  expect(propios.some((r) => r.url.endsWith('.css'))).toBe(true)
  expect(propios.filter((r) => r.status >= 400)).toEqual([])
  // Ningún recurso apunta a una ruta fuera de la base (típico error de despliegue en subcarpeta).
  const origen = new URL(baseURL!).origin
  const base = new URL(baseURL!).pathname
  const fuera = recursos.filter((r) => r.url.startsWith(origen) && !new URL(r.url).pathname.startsWith(base))
  expect(fuera.map((r) => r.url)).toEqual([])
})

test('la política de seguridad (CSP) está presente y es estricta', async ({ page }) => {
  await page.goto('')
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(csp).toContain("script-src 'self'")
  expect(csp).toContain("object-src 'none'")
  expect(csp).not.toContain('unsafe-eval')
  expect(csp).not.toContain('unsafe-inline')
})

test('el catálogo carga datos reales del servidor (no queda cargando ni en error)', async ({ page }) => {
  await page.goto('#/catalogo')
  await expect(page.getByRole('status').filter({ hasText: /productos?$/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('contacto: el WhatsApp configurado es un enlace wa.me válido que no se abre', async ({ page }) => {
  const aWhatsApp: string[] = []
  page.on('request', (r) => r.url().includes('wa.me') && aWhatsApp.push(r.url()))
  await page.goto('#/contacto')
  const enlace = page.getByRole('link', { name: /Escribir por WhatsApp/ })
  await expect(enlace).toBeVisible({ timeout: 15_000 })
  await expect(enlace).toHaveAttribute('href', /^https:\/\/wa\.me\/\d{10,15}$/)
  await expect(enlace).toHaveAttribute('rel', /noopener/)
  expect(aWhatsApp).toEqual([])
})

test('un carrito vacío no permite registrar pedidos (la producción no recibe pedidos de prueba)', async ({ page }) => {
  await page.goto('#/checkout')
  await expect(page.getByText('Tu carrito está vacío.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar pedido' })).toHaveCount(0)
})

test('el seguimiento de un pedido inexistente no revela nada', async ({ page }) => {
  await page.goto('#/pedido/L-NOEXISTE?t=token-falso')
  await expect(page.getByText('No encontramos ese pedido.')).toBeVisible({ timeout: 15_000 })
})

test('el panel pide sesión y no hace peticiones privadas sin ella', async ({ page }) => {
  const privadas: string[] = []
  page.on('request', (r) => /admin_dashboard|\/rest\/v1\/(orders|payments|inventory_movements)/.test(r.url()) && privadas.push(r.url()))
  await page.goto('#/admin/pedidos')
  await expect(page.getByRole('heading', { level: 1, name: 'Acceso administrador' })).toBeVisible()
  expect(privadas).toEqual([])
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

test('sin desbordamiento horizontal en las pantallas públicas', async ({ page }) => {
  for (const [ruta] of rutas.slice(0, 8)) {
    await page.goto(ruta)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), ruta).toBe(false)
  }
})
