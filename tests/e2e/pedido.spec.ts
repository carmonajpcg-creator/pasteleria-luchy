import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { isoDaysFromNow, mockSupabase, stubWhatsApp } from './helpers'

const wcag = ['wcag2a', 'wcag2aa', 'wcag21aa']

async function agregar(page: Page, slug: string, cantidad = 1, personalizacion?: string) {
  await page.goto(`/#/producto/${slug}`)
  for (let i = 1; i < cantidad; i++) {
    await page.getByRole('button', { name: /Agregar una unidad de/ }).click()
  }
  if (personalizacion) await page.getByLabel('Personalización (opcional)').fill(personalizacion)
  await page.getByRole('button', { name: 'Agregar al carrito' }).click()
  await expect(page.getByText('Agregado al carrito.')).toBeVisible()
}

async function llenarCheckout(page: Page, over: { fecha?: string } = {}) {
  await page.getByLabel('Nombre').fill('Ana López')
  await page.getByLabel('Teléfono / WhatsApp').fill('55 1234 5678')
  await page.getByLabel('Fecha solicitada').fill(over.fecha ?? isoDaysFromNow(10))
  await page.getByLabel('Notas (opcional)').fill('Sin nueces')
  await page.getByRole('checkbox', { name: /Acepto el aviso de privacidad/ }).check()
}

test.describe('carrito', () => {
  test.beforeEach(({ page }) => mockSupabase(page))

  // E04: cantidad, eliminar, persistencia, total estimado.
  test('agrega, cambia cantidad, elimina y persiste tras recargar', async ({ page }) => {
    await agregar(page, 'cupcake-vainilla', 2)
    await expect(page.getByRole('link', { name: 'Carrito, 2 productos' })).toBeVisible()
    await agregar(page, 'pastel-tres-leches')
    await expect(page.getByRole('link', { name: 'Carrito, 3 productos' })).toBeVisible()

    await page.goto('/#/carrito')
    await expect(page.getByText('Total estimado').first()).toBeVisible()
    // 2 × $45.00 + 1 × $600.00
    await expect(page.getByRole('complementary')).toContainText('$690.00 MXN')

    await page.getByRole('button', { name: 'Agregar una unidad de Cupcake de vainilla' }).click()
    await expect(page.getByRole('complementary')).toContainText('$735.00 MXN')
    await page.getByRole('button', { name: 'Quitar una unidad de Cupcake de vainilla' }).click()
    await expect(page.getByRole('complementary')).toContainText('$690.00 MXN')

    await page.reload()
    await expect(page.getByRole('group', { name: 'Cantidad de Cupcake de vainilla' })).toContainText('2')
    await page.getByRole('button', { name: 'Eliminar Pastel de tres leches del carrito' }).click()
    await expect(page.getByRole('complementary')).toContainText('$90.00 MXN')

    await page.getByRole('button', { name: 'Eliminar Cupcake de vainilla del carrito' }).click()
    await expect(page.getByText('Tu carrito está vacío.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Carrito', exact: true })).toBeVisible()
  })

  test('un producto agotado no se puede agregar', async ({ page }) => {
    await page.goto('/#/producto/cupcake-chocolate')
    await expect(page.getByText('Este producto está agotado por ahora.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Agregar al carrito' })).toHaveCount(0)
  })

  test('el checkout sin productos invita a ver el catálogo', async ({ page }) => {
    await page.goto('/#/checkout')
    await expect(page.getByText('Tu carrito está vacío.')).toBeVisible()
  })

  test('un valor manipulado en localStorage no rompe la app', async ({ page }) => {
    await page.goto('/#/')
    await page.evaluate(() =>
      localStorage.setItem(
        'luchy-cart',
        JSON.stringify({ state: { items: [{ productId: 'p3', quantity: 99999 }, { productId: 7 }, null] }, version: 1 }),
      ),
    )
    await page.goto('/#/carrito')
    await page.reload()
    await expect(page.getByRole('group', { name: 'Cantidad de Cupcake de vainilla' })).toContainText('99')
  })
})

test.describe('checkout y pedido', () => {
  test('E05: valida campos, fecha y consentimiento antes de crear el pedido', async ({ page }) => {
    const { createOrderCalls } = await mockSupabase(page)
    await agregar(page, 'pastel-tres-leches')
    await page.goto('/#/checkout')

    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page.getByText('Escribe tu nombre')).toBeVisible()
    await expect(page.getByText(/teléfono válido/)).toBeVisible()
    await expect(page.getByText('Elige una fecha', { exact: true })).toBeVisible()
    await expect(page.getByText(/Debes aceptar el aviso de privacidad/)).toBeVisible()
    await expect(page.getByLabel('Nombre')).toHaveAttribute('aria-invalid', 'true')

    // El pastel pide 2 días de anticipación: una fecha de mañana se rechaza.
    await llenarCheckout(page, { fecha: isoDaysFromNow(1) })
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page.getByText('Elige una fecha a partir del día indicado')).toBeVisible()
    expect(createOrderCalls).toHaveLength(0)
  })

  test('E06: crea el pedido, muestra el folio y arma el enlace de WhatsApp sin enviar nada', async ({ page }) => {
    const { createOrderCalls } = await mockSupabase(page)
    const whatsapp = await stubWhatsApp(page)
    await agregar(page, 'cupcake-vainilla', 2)
    await agregar(page, 'pastel-tres-leches', 1, 'Feliz cumpleaños Ana')

    await page.goto('/#/checkout')
    await expect(page.getByText(/no está confirmado/)).toBeVisible()
    await llenarCheckout(page)
    await page.getByRole('button', { name: 'Registrar pedido' }).click()

    await expect(page).toHaveURL(/#\/pedido\/L-TEST001\?t=token-1$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Seguimiento de pedido' })).toBeVisible()
    await expect(page.getByText('L-TEST001').first()).toBeVisible()
    await expect(page.getByText(/Abrir WhatsApp no envía el mensaje ni confirma tu pedido/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Carrito', exact: true })).toBeVisible() // carrito vaciado

    // El cliente solo envía producto/cantidad/personalización: nunca precios ni totales.
    expect(createOrderCalls).toHaveLength(1)
    const body = createOrderCalls[0]!.body
    expect(JSON.stringify(body)).not.toMatch(/price|total|precio/i)
    expect(body).toMatchObject({
      p_customer_name: 'Ana López',
      p_privacy_accepted: true,
      p_fulfillment: 'pickup',
      p_items: expect.arrayContaining([
        { product_id: 'p3', quantity: 2, customization: null },
        { product_id: 'p1', quantity: 1, customization: 'Feliz cumpleaños Ana' },
      ]),
    })

    const enlace = page.getByRole('link', { name: /Continuar a WhatsApp/ })
    const href = (await enlace.getAttribute('href'))!
    const url = new URL(href)
    expect(url.origin + url.pathname).toBe('https://wa.me/525500000000')
    const texto = url.searchParams.get('text')!
    expect(texto).toContain('pedido L-TEST001')
    expect(texto).toContain('- 2 x Cupcake de vainilla — $90.00 MXN')
    expect(texto).toContain('- 1 x Pastel de tres leches — $600.00 MXN (Personalización: Feliz cumpleaños Ana)')
    expect(texto).toContain('Total estimado: $690.00 MXN')
    expect(texto).toContain('Nombre: Ana López')
    expect(texto).toContain('Notas: Sin nueces')

    // Se simula la apertura: la petición a wa.me queda interceptada, no se envía nada real.
    const [popup] = await Promise.all([page.waitForEvent('popup'), enlace.click()])
    await popup.waitForLoadState()
    expect(whatsapp.opened).toHaveLength(1)
    expect(whatsapp.opened[0]).toBe(href)
  })

  test('E07: un doble clic crea un solo pedido', async ({ page }) => {
    const { createOrderCalls } = await mockSupabase(page, { createOrderDelayMs: 700 })
    await agregar(page, 'cupcake-vainilla')
    await page.goto('/#/checkout')
    await llenarCheckout(page)
    await page.getByRole('button', { name: 'Registrar pedido' }).dblclick()
    await expect(page).toHaveURL(/#\/pedido\/L-TEST001/)
    expect(createOrderCalls).toHaveLength(1)
  })

  test('E07: tras un fallo, el reintento reutiliza la misma clave de idempotencia', async ({ page }) => {
    const { createOrderCalls } = await mockSupabase(page, { createOrderFailures: 1 })
    await agregar(page, 'cupcake-vainilla')
    await page.goto('/#/checkout')
    await llenarCheckout(page)

    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'No pudimos registrar tu pedido' })).toBeVisible()
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page).toHaveURL(/#\/pedido\/L-TEST001/)

    expect(createOrderCalls).toHaveLength(2)
    expect(createOrderCalls[1]!.idempotencyKey).toBe(createOrderCalls[0]!.idempotencyKey)
  })

  test('si cambia el carrito se usa otra clave de idempotencia', async ({ page }) => {
    const { createOrderCalls } = await mockSupabase(page, { createOrderFailures: 1 })
    await agregar(page, 'cupcake-vainilla')
    await page.goto('/#/checkout')
    await llenarCheckout(page)
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'No pudimos registrar tu pedido' })).toBeVisible()

    await agregar(page, 'mini-tiramisu')
    await page.goto('/#/checkout')
    await llenarCheckout(page)
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page).toHaveURL(/#\/pedido\/L-TEST001/)
    expect(createOrderCalls[1]!.idempotencyKey).not.toBe(createOrderCalls[0]!.idempotencyKey)
  })

  test('un error de negocio del servidor se muestra y conserva el carrito', async ({ page }) => {
    await mockSupabase(page, { createOrderError: { code: '22023', message: 'Existencias insuficientes' } })
    await agregar(page, 'cupcake-vainilla')
    await page.goto('/#/checkout')
    await llenarCheckout(page)
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Existencias insuficientes' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Carrito, 1 producto' })).toBeVisible()
  })

  test('E08: /pedido sin token o con token falso no muestra datos', async ({ page }) => {
    await mockSupabase(page)
    await page.goto('/#/pedido/L-TEST001')
    await expect(page.getByText(/Por seguridad no se muestran pedidos solo con el folio/)).toBeVisible()
    await page.goto('/#/pedido/L-TEST001?t=falso')
    await expect(page.getByText('No encontramos ese pedido.')).toBeVisible()
    await expect(page.getByText('Ana')).toHaveCount(0)
  })

  test('accesibilidad de carrito, checkout y pedido (axe)', async ({ page }) => {
    await mockSupabase(page)
    await agregar(page, 'pastel-tres-leches')
    for (const ruta of ['/#/carrito', '/#/checkout']) {
      await page.goto(ruta)
      await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
      const r = await new AxeBuilder({ page }).withTags(wcag).analyze()
      expect(r.violations, ruta).toEqual([])
    }
    await page.getByRole('button', { name: 'Registrar pedido' }).click() // errores visibles
    const conErrores = await new AxeBuilder({ page }).withTags(wcag).analyze()
    expect(conErrores.violations, 'checkout con errores').toEqual([])

    await llenarCheckout(page)
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page.getByRole('link', { name: /Continuar a WhatsApp/ })).toBeVisible()
    const pedido = await new AxeBuilder({ page }).withTags(wcag).analyze()
    expect(pedido.violations, 'pedido').toEqual([])
  })

  test('sin desbordamiento horizontal en carrito y checkout', async ({ page }) => {
    await mockSupabase(page)
    await agregar(page, 'pastel-tres-leches')
    for (const ruta of ['/#/carrito', '/#/checkout']) {
      await page.goto(ruta)
      await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), ruta).toBe(false)
    }
  })
})
