import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { mockSupabase } from './helpers'

test.beforeEach(({ page }) => mockSupabase(page))

// E01: todas las rutas cargan sin errores de consola; recarga en ruta profunda funciona.
const rutas: [string, string][] = [
  ['/#/', 'Pastelería Luchy'],
  ['/#/catalogo', 'Catálogo'],
  ['/#/producto/pastel-tres-leches', 'Pastel de tres leches'],
  ['/#/carrito', 'Carrito'],
  ['/#/checkout', 'Checkout'],
  ['/#/pedido/LUCHY-0001', 'Seguimiento de pedido'],
  ['/#/nosotros', 'Nosotros'],
  ['/#/contacto', 'Contacto'],
  ['/#/privacidad', 'Aviso de privacidad'],
  ['/#/condiciones', 'Condiciones de pedido'],
  ['/#/admin/login', 'Acceso administrador'],
  // Rutas protegidas del panel: sin sesión, la recarga en ruta profunda termina en el login (Fase 7).
  // El contenido real de cada pantalla se prueba con sesión en admin.spec.ts.
  ['/#/admin', 'Acceso administrador'],
  ['/#/admin/productos', 'Acceso administrador'],
  ['/#/admin/productos/nuevo', 'Acceso administrador'],
  ['/#/admin/categorias', 'Acceso administrador'],
  ['/#/admin/inventario', 'Acceso administrador'],
  ['/#/admin/pedidos', 'Acceso administrador'],
  ['/#/admin/pedidos/o1', 'Acceso administrador'],
  ['/#/admin/configuracion', 'Acceso administrador'],
  ['/#/no-existe', 'Página no encontrada'],
]

for (const [ruta, titulo] of rutas) {
  test(`carga ${ruta} sin errores de consola`, async ({ page }) => {
    const errores: string[] = []
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
    page.on('pageerror', (e) => errores.push(e.message))

    await page.goto(ruta)
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
    expect(errores).toEqual([])
  })
}

test('navegación principal entre páginas', async ({ page }) => {
  await page.goto('/#/')
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Catálogo' }).click()
  await expect(page).toHaveURL(/#\/catalogo$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Catálogo' })).toBeVisible()
})

test('sin desbordamiento horizontal', async ({ page }) => {
  await page.goto('/#/catalogo')
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  expect(desborda).toBe(false)
})

test('accesibilidad básica (axe, WCAG A/AA)', async ({ page }) => {
  await page.goto('/#/catalogo')
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(r.violations).toEqual([])
})

test('primer foco con teclado: saltar al contenido', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Teclado no aplica en emulación táctil')
  await page.goto('/#/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused()
})
