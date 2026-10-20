import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { mockSupabase } from './helpers'

const wcag = ['wcag2a', 'wcag2aa', 'wcag21aa']

test.describe('catálogo', () => {
  test.beforeEach(({ page }) => mockSupabase(page))

  // E02: búsqueda y filtro por categoría devuelven los productos esperados.
  test('muestra todos los productos y su cuenta', async ({ page }) => {
    await page.goto('/#/catalogo')
    await expect(page.getByRole('status').filter({ hasText: 'productos' })).toHaveText('5 productos')
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(5)
  })

  test('filtra por categoría y lo refleja en la URL', async ({ page }) => {
    await page.goto('/#/catalogo')
    await page.getByRole('button', { name: 'Cupcakes' }).click()
    await expect(page.getByRole('button', { name: 'Cupcakes' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('status').filter({ hasText: 'productos' })).toHaveText('2 productos')
    await expect(page).toHaveURL(/categoria=cupcakes/)

    await page.reload()
    await expect(page.getByRole('status').filter({ hasText: 'productos' })).toHaveText('2 productos')
  })

  test('busca sin distinguir acentos ni mayúsculas', async ({ page }) => {
    await page.goto('/#/catalogo')
    await page.getByRole('searchbox', { name: 'Buscar productos' }).fill('TIRAMISU')
    await expect(page.getByRole('heading', { level: 3 })).toHaveText('Mini tiramisú')
  })

  test('sin resultados ofrece quitar filtros', async ({ page }) => {
    await page.goto('/#/catalogo?q=zzzz')
    await expect(page.getByText('No encontramos productos con esos filtros.')).toBeVisible()
    await page.getByRole('button', { name: 'Quitar filtros' }).click()
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(5)
  })

  test('las tarjetas indican disponibilidad con texto y precio provisional', async ({ page }) => {
    await page.goto('/#/catalogo')
    const tarjeta = (nombre: string) => page.getByRole('article').filter({ hasText: nombre })
    await expect(tarjeta('Pastel de tres leches')).toContainText('Bajo pedido')
    await expect(tarjeta('Cupcake de vainilla')).toContainText('Disponible')
    await expect(tarjeta('Cupcake de chocolate')).toContainText('Agotado')
    await expect(tarjeta('Cupcake de vainilla')).toContainText('$45.00 MXN')
    await expect(tarjeta('Cupcake de vainilla')).toContainText('Precio provisional')
    await expect(tarjeta('Cupcake de vainilla').getByRole('img')).toHaveAccessibleName(/Imagen de ejemplo/)
  })

  test('error de la API muestra aviso y permite reintentar', async ({ page }) => {
    await page.unrouteAll()
    await mockSupabase(page, { productsStatus: 500 })
    await page.goto('/#/catalogo')
    await expect(page.getByRole('alert')).toContainText('No pudimos cargar el catálogo')
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  })

  test('accesibilidad del catálogo con datos (axe)', async ({ page }) => {
    await page.goto('/#/catalogo')
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(5)
    const r = await new AxeBuilder({ page }).withTags(wcag).analyze()
    expect(r.violations).toEqual([])
  })

  test('sin desbordamiento horizontal con datos', async ({ page }) => {
    await page.goto('/#/catalogo')
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  })
})

test.describe('inicio y detalle', () => {
  test.beforeEach(({ page }) => mockSupabase(page))

  test('el inicio muestra categorías y destacados', async ({ page }) => {
    await page.goto('/#/')
    await expect(page.getByRole('link', { name: 'Pasteles', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(2)
    await page.getByRole('link', { name: 'Cupcakes', exact: true }).click()
    await expect(page).toHaveURL(/#\/catalogo\?categoria=cupcakes/)
    await expect(page.getByRole('status').filter({ hasText: 'productos' })).toHaveText('2 productos')
  })

  // E03: detalle con precio, disponibilidad y preparación.
  test('el detalle muestra precio, disponibilidad, preparación y alérgenos por verificar', async ({ page }) => {
    await page.goto('/#/catalogo')
    await page.getByRole('link', { name: /Ver detalle de Pastel de tres leches/ }).click()
    await expect(page).toHaveURL(/#\/producto\/pastel-tres-leches$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pastel de tres leches')
    await expect(page.getByText('$600.00 MXN')).toBeVisible()
    await expect(page.getByText('Bajo pedido').first()).toBeVisible()
    await expect(page.getByText('anticipación de al menos 2 días')).toBeVisible()
    await expect(page.getByText('por verificar por la tienda')).toBeVisible()
  })

  test('los alérgenos solo se muestran si la tienda los verificó', async ({ page }) => {
    await page.goto('/#/producto/mini-tiramisu')
    await expect(page.getByText('Gluten, Lácteos, Huevo')).toBeVisible()
  })

  test('alérgenos verificados sin lista: «ninguno declarado», nunca «por verificar»', async ({ page }) => {
    await page.goto('/#/producto/cupcake-vainilla')
    await expect(page.getByText('ninguno declarado por la tienda')).toBeVisible()
    await expect(page.getByText('por verificar por la tienda')).toHaveCount(0)
  })

  test('un producto inexistente muestra mensaje claro', async ({ page }) => {
    await page.goto('/#/producto/no-existe')
    await expect(page.getByRole('heading', { level: 1, name: 'Producto no encontrado' })).toBeVisible()
  })

  test('contacto usa la configuración pública y enlaza a WhatsApp sin enviar nada', async ({ page }) => {
    await page.goto('/#/contacto')
    const enlace = page.getByRole('link', { name: /Escribir por WhatsApp/ })
    await expect(enlace).toHaveAttribute('href', 'https://wa.me/525500000000')
    await expect(page.getByText('por definir').first()).toBeVisible()
  })

  test('accesibilidad del detalle y del contacto (axe)', async ({ page }) => {
    for (const ruta of ['/#/producto/pastel-tres-leches', '/#/contacto', '/#/']) {
      await page.goto(ruta)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.waitForLoadState('networkidle')
      const r = await new AxeBuilder({ page }).withTags(wcag).analyze()
      expect(r.violations, ruta).toEqual([])
    }
  })
})
