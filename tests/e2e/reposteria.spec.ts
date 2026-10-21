import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ADMIN, mockAdmin } from './adminHelpers'
import { mockSupabase, utcDaysFromNow } from './helpers'

const wcag = ['wcag2a', 'wcag2aa', 'wcag21aa']
const fecha = (iso: string) => iso.split('-').reverse().join('/')

async function agregar(page: Page, slug: string) {
  await page.goto(`/#/producto/${slug}`)
  await page.getByRole('button', { name: 'Agregar al carrito' }).click()
  await expect(page.getByText('Agregado al carrito.')).toBeVisible()
}

async function datosCliente(page: Page) {
  await page.getByLabel('Nombre').fill('Ana López')
  await page.getByLabel('Teléfono / WhatsApp').fill('55 1234 5678')
  await page.getByRole('checkbox', { name: /Acepto el aviso de privacidad/ }).check()
}

test.describe('personalización', () => {
  test.beforeEach(({ page }) => mockSupabase(page))

  test('solo los productos que la admiten muestran el campo, con la pista de la tienda', async ({ page }) => {
    await page.goto('/#/producto/pastel-tres-leches')
    const campo = page.getByLabel('Personalización (opcional)')
    await expect(campo).toBeVisible()
    await expect(campo).toHaveAttribute('placeholder', 'Texto en el pastel')
    await expect(page.getByText('0/500')).toBeVisible()
    await campo.fill('Feliz cumpleaños')
    await expect(page.getByText('16/500')).toBeVisible()

    // Un pastel bajo pedido SIN la opción activada tampoco muestra el campo (antes aparecía en todos).
    await page.goto('/#/producto/pastel-chocolate-fudge')
    await expect(page.getByRole('button', { name: 'Agregar al carrito' })).toBeVisible()
    await expect(page.getByLabel('Personalización (opcional)')).toHaveCount(0)
    await page.goto('/#/producto/cupcake-vainilla')
    await expect(page.getByLabel('Personalización (opcional)')).toHaveCount(0)
  })

  test('la personalización viaja en el pedido solo para productos que la admiten', async ({ page }) => {
    const { createOrderCalls } = await mockSupabase(page)
    await page.goto('/#/producto/pastel-tres-leches')
    await page.getByLabel('Personalización (opcional)').fill('Feliz cumpleaños Ana')
    await page.getByRole('button', { name: 'Agregar al carrito' }).click()
    await agregar(page, 'cupcake-vainilla')

    await page.goto('/#/carrito')
    await expect(page.getByText('Personalización: Feliz cumpleaños Ana')).toBeVisible()

    // Una personalización guardada de un producto que ya no la admite se ignora (datos viejos del carrito).
    await page.evaluate(() => {
      const cart = JSON.parse(localStorage.getItem('luchy-cart') as string)
      cart.state.items = cart.state.items.map((i: { productId: string }) =>
        i.productId === 'p3' ? { ...i, customization: 'texto que ya no aplica' } : i,
      )
      localStorage.setItem('luchy-cart', JSON.stringify(cart))
    })
    await page.reload()
    await expect(page.getByText('texto que ya no aplica')).toHaveCount(0)

    await page.goto('/#/checkout')
    await datosCliente(page)
    await page.getByLabel('Fecha solicitada').fill(utcDaysFromNow(10))
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page).toHaveURL(/#\/pedido\/L-TEST001/)
    const items = (createOrderCalls[0]!.body.p_items as { product_id: string; customization: string | null }[])
    expect(items.find((i) => i.product_id === 'p1')!.customization).toBe('Feliz cumpleaños Ana')
    expect(items.find((i) => i.product_id === 'p3')!.customization).toBeNull()
  })

  test('accesibilidad del campo de personalización (axe)', async ({ page }) => {
    await page.goto('/#/producto/pastel-tres-leches')
    await expect(page.getByLabel('Personalización (opcional)')).toBeVisible()
    const r = await new AxeBuilder({ page }).withTags(wcag).analyze()
    expect(r.violations).toEqual([])
  })
})

test.describe('fechas, anticipación y capacidad en el checkout', () => {
  test('la primera fecha disponible salta los días cerrados y se usa como mínimo', async ({ page }) => {
    const hoy = utcDaysFromNow(0)
    await mockSupabase(page, { closedDates: [hoy, utcDaysFromNow(1)] })
    await agregar(page, 'cupcake-vainilla') // sin anticipación: hoy sería la primera fecha
    await page.goto('/#/checkout')
    const esperada = utcDaysFromNow(2)
    await expect(page.getByText(`Primera fecha disponible: ${fecha(esperada)}`)).toBeVisible()
    await expect(page.getByLabel('Fecha solicitada')).toHaveAttribute('min', esperada)
  })

  test('un día cerrado se rechaza antes de enviar y sugiere el siguiente disponible', async ({ page }) => {
    const cerrado = utcDaysFromNow(5)
    const { createOrderCalls } = await mockSupabase(page, { closedDates: [cerrado] })
    await agregar(page, 'cupcake-vainilla')
    await page.goto('/#/checkout')
    await datosCliente(page)
    await page.getByLabel('Fecha solicitada').fill(cerrado)
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'La tienda no recibe pedidos para esa fecha.' })).toContainText(
      `Prueba con el ${fecha(utcDaysFromNow(6))}`,
    )
    expect(createOrderCalls).toHaveLength(0)

    await page.getByLabel('Fecha solicitada').fill(utcDaysFromNow(6))
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page).toHaveURL(/#\/pedido\/L-TEST001/)
    expect(createOrderCalls).toHaveLength(1)
  })

  test('un día sin cupo se rechaza con su propio mensaje', async ({ page }) => {
    const lleno = utcDaysFromNow(7)
    await mockSupabase(page, { fullDates: [lleno] })
    await agregar(page, 'pastel-tres-leches')
    await page.goto('/#/checkout')
    await datosCliente(page)
    await page.getByLabel('Fecha solicitada').fill(lleno)
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Ya no hay cupo para esa fecha.' })).toBeVisible()
  })

  test('la anticipación del producto (48 h) mueve la primera fecha disponible', async ({ page }) => {
    await mockSupabase(page)
    await agregar(page, 'pastel-tres-leches')
    await page.goto('/#/checkout')
    await expect(page.getByText(`Primera fecha disponible: ${fecha(utcDaysFromNow(2))}`)).toBeVisible()
    await expect(page.getByText(/productos bajo pedido con anticipación mínima/)).toBeVisible()
    await datosCliente(page)
    await page.getByLabel('Fecha solicitada').fill(utcDaysFromNow(1))
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page.getByText('Elige una fecha a partir del día indicado')).toBeVisible()
  })

  test('si no se puede consultar la disponibilidad, el servidor decide y su mensaje se muestra', async ({ page }) => {
    const cerrado = utcDaysFromNow(5)
    await mockSupabase(page, {
      availabilityStatus: 500,
      createOrderError: { code: '22023', message: 'La tienda no recibe pedidos para esa fecha; elige otra' },
    })
    await agregar(page, 'cupcake-vainilla')
    await page.goto('/#/checkout')
    await datosCliente(page)
    await page.getByLabel('Fecha solicitada').fill(cerrado)
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'La tienda no recibe pedidos para esa fecha; elige otra' })).toBeVisible()
  })

  test('sin ninguna fecha disponible el formulario lo explica', async ({ page }) => {
    const todos = Array.from({ length: 105 }, (_, i) => utcDaysFromNow(i))
    await mockSupabase(page, { closedDates: todos })
    await agregar(page, 'cupcake-vainilla')
    await page.goto('/#/checkout')
    await expect(page.getByText(/no hay fechas disponibles en los próximos meses/)).toBeVisible()
  })

  test('accesibilidad del checkout con errores de fecha (axe)', async ({ page }) => {
    const cerrado = utcDaysFromNow(5)
    await mockSupabase(page, { closedDates: [cerrado] })
    await agregar(page, 'cupcake-vainilla')
    await page.goto('/#/checkout')
    await datosCliente(page)
    await page.getByLabel('Fecha solicitada').fill(cerrado)
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'La tienda no recibe pedidos' })).toBeVisible()
    const r = await new AxeBuilder({ page }).withTags(wcag).analyze()
    expect(r.violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  })
})

test.describe('revisión Opus: domingos solo con entrega y doble envío', () => {
  test('un día sin recolección rechaza «recolección» y acepta «entrega a domicilio»', async ({ page }) => {
    const domingo = utcDaysFromNow(4)
    const { createOrderCalls } = await mockSupabase(page, { pickupClosedDates: [domingo] })
    await agregar(page, 'cupcake-vainilla')
    await page.goto('/#/checkout')
    await datosCliente(page)
    await page.getByLabel('Fecha solicitada').fill(domingo)
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(
      page.getByRole('alert').filter({ hasText: 'Ese día no hay recolección en tienda; puedes elegir entrega a domicilio.' }),
    ).toBeVisible()
    expect(createOrderCalls).toHaveLength(0)

    await page.getByLabel('Modalidad').selectOption('delivery')
    // La disponibilidad se vuelve a pedir para la nueva modalidad antes de validar.
    await expect(page.getByText(/Primera fecha disponible/)).toBeVisible()
    await page.getByRole('button', { name: 'Registrar pedido' }).click()
    await expect(page).toHaveURL(/#\/pedido\/L-TEST001/)
    expect(createOrderCalls[0]!.body).toMatchObject({ p_fulfillment: 'delivery', p_requested_date: domingo })
  })
})

test.describe('panel: personalización, días cerrados y capacidad', () => {
  test('configuración: días sin recolección (domingo) independientes del cierre total', async ({ page }) => {
    await mockSupabase(page)
    const { calls } = await mockAdmin(page)
    await page.goto('/#/admin/login')
    await page.getByLabel('Correo').fill(ADMIN.email)
    await page.getByLabel('Contraseña').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Panel administrativo' })).toBeVisible()
    await page.goto('/#/admin/configuracion')
    await page.getByRole('checkbox', { name: 'Sin recolección el domingo' }).check()
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByText('Cambios guardados.')).toBeVisible()
    expect(calls.settingsPatches[0]).toMatchObject({ pickup_closed_weekdays: [0], closed_weekdays: [] })
    const r = await new AxeBuilder({ page }).withTags(wcag).analyze()
    expect(r.violations).toEqual([])
  })

  test('H3: confirmar un pendiente caducado en un día lleno avisa y pide confirmación', async ({ page }) => {
    await mockSupabase(page)
    const { state, calls } = await mockAdmin(page)
    state.settings.daily_capacity = 1
    const dia = utcDaysFromNow(5)
    Object.assign(state.orders[0]!, { requested_date: dia, expires_at: '2020-01-01T00:00:00Z' }) // caducado
    Object.assign(state.orders[1]!, { requested_date: dia }) // ocupa el único lugar
    await page.goto('/#/admin/login')
    await page.getByLabel('Correo').fill(ADMIN.email)
    await page.getByLabel('Contraseña').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Panel administrativo' })).toBeVisible()
    await page.goto('/#/admin/pedidos/o1')

    await expect(page.getByRole('alert').filter({ hasText: 'Este pedido caducó' })).toContainText('1 de 1')
    page.once('dialog', (d) => void d.dismiss())
    await page.getByRole('button', { name: 'Confirmar pedido' }).click()
    await expect(page.getByText(/Estado:/)).toContainText('Pendiente de confirmar')
    expect(calls.confirmOrder).toHaveLength(0)

    page.once('dialog', (d) => void d.accept())
    await page.getByRole('button', { name: 'Confirmar pedido' }).click()
    await expect(page.getByText(/Estado:/)).toContainText('Confirmado')
    expect(calls.confirmOrder).toEqual(['o1'])
  })

  test('un pendiente vigente en un día con cupo no muestra el aviso', async ({ page }) => {
    await mockSupabase(page)
    const { state } = await mockAdmin(page)
    state.settings.daily_capacity = 5
    state.orders[0]!.expires_at = '2099-01-01T00:00:00Z'
    await page.goto('/#/admin/login')
    await page.getByLabel('Correo').fill(ADMIN.email)
    await page.getByLabel('Contraseña').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Panel administrativo' })).toBeVisible()
    await page.goto('/#/admin/pedidos/o1')
    await expect(page.getByRole('button', { name: 'Confirmar pedido' })).toBeVisible()
    await expect(page.getByText('Este pedido caducó')).toHaveCount(0)
  })

  async function entrar(page: Page, ruta: string) {
    await mockSupabase(page)
    const mocks = await mockAdmin(page)
    await page.goto('/#/admin/login')
    await page.getByLabel('Correo').fill(ADMIN.email)
    await page.getByLabel('Contraseña').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Panel administrativo' })).toBeVisible()
    await page.goto(`/#${ruta}`)
    return mocks
  }

  test('el producto activa la personalización y su pista solo aparece si está activada', async ({ page }) => {
    const { calls } = await entrar(page, '/admin/productos/p2')
    await expect(page.getByRole('heading', { level: 1, name: 'Pastel de chocolate fudge' })).toBeVisible()
    await expect(page.getByLabel('Pista para el cliente')).toHaveCount(0)

    await page.getByRole('checkbox', { name: /Admite personalización/ }).check()
    await page.getByLabel('Pista para el cliente').fill('Dedicatoria del pastel')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect.poll(() => calls.productWrites.length).toBe(1)
    expect(calls.productWrites[0]).toMatchObject({
      method: 'PATCH',
      body: { allows_customization: true, customization_hint: 'Dedicatoria del pastel' },
    })
  })

  test('desactivar la personalización borra la pista', async ({ page }) => {
    const { calls } = await entrar(page, '/admin/productos/p1')
    await expect(page.getByLabel('Pista para el cliente')).toHaveValue('Texto en el pastel')
    await page.getByRole('checkbox', { name: /Admite personalización/ }).uncheck()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect.poll(() => calls.productWrites.length).toBe(1)
    expect(calls.productWrites[0]!.body).toMatchObject({ allows_customization: false, customization_hint: null })
  })

  test('configuración: días cerrados, capacidad y anticipación general se validan y guardan', async ({ page }) => {
    const { calls } = await entrar(page, '/admin/configuracion')
    await expect(page.getByLabel('Capacidad diaria (pedidos bajo pedido)')).toHaveValue('')
    await expect(page.getByText(/Sin límite y sin días cerrados por defecto/)).toBeVisible()

    await page.getByLabel('Fechas cerradas (vacaciones, festivos)').fill('2026-02-30')
    await page.getByLabel('Capacidad diaria (pedidos bajo pedido)').fill('0')
    await page.getByLabel('Anticipación general (horas)').fill('999')
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByText(/Fecha no válida: 2026-02-30/)).toBeVisible()
    await expect(page.getByText(/1 a 1000/)).toBeVisible()
    await expect(page.getByText(/0 a 720/)).toBeVisible()
    expect(calls.settingsPatches).toHaveLength(0)

    await page.getByLabel('Fechas cerradas (vacaciones, festivos)').fill('2026-12-25, 2026-12-24')
    await page.getByLabel('Capacidad diaria (pedidos bajo pedido)').fill('4')
    await page.getByLabel('Anticipación general (horas)').fill('24')
    await page.getByRole('checkbox', { name: 'Domingo', exact: true }).check()
    await page.getByRole('checkbox', { name: 'Lunes', exact: true }).check()
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByText('Cambios guardados.')).toBeVisible()
    expect(calls.settingsPatches[0]).toMatchObject({
      closed_weekdays: [0, 1],
      closed_dates: ['2026-12-24', '2026-12-25'],
      daily_capacity: 4,
      min_lead_hours: 24,
    })
  })

  test('no se puede cerrar toda la semana', async ({ page }) => {
    const { calls } = await entrar(page, '/admin/configuracion')
    for (const dia of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      await page.getByRole('checkbox', { name: dia, exact: true }).check()
    }
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'No puedes cerrar los 7 días de la semana' })).toBeVisible()
    expect(calls.settingsPatches).toHaveLength(0)
  })

  test('el panel muestra la carga de los próximos días frente a la capacidad', async ({ page }) => {
    await mockSupabase(page)
    const { state } = await mockAdmin(page)
    state.settings.daily_capacity = 2
    state.settings.closed_dates = [utcDaysFromNow(2)]
    state.settings.pickup_closed_weekdays = [0]
    state.orders[0]!.requested_date = utcDaysFromNow(1)
    state.orders[1]!.requested_date = utcDaysFromNow(1)
    await page.goto('/#/admin/login')
    await page.getByLabel('Correo').fill(ADMIN.email)
    await page.getByLabel('Contraseña').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Entrar' }).click()

    const seccion = page.getByRole('heading', { name: 'Carga de los próximos 14 días' }).locator('..')
    await expect(seccion).toContainText('Capacidad diaria: 2.')
    await expect(seccion.getByRole('listitem')).toHaveCount(14)
    await expect(seccion).toContainText('2 de 2 · lleno')
    await expect(seccion).toContainText('Cerrado')
    await expect(seccion).toContainText('Solo entrega a domicilio') // 14 días siempre incluyen un domingo
    const r = await new AxeBuilder({ page }).withTags(wcag).analyze()
    expect(r.violations).toEqual([])
  })

  test('sin capacidad configurada el panel lo indica y ofrece definirla', async ({ page }) => {
    await entrar(page, '/admin')
    const seccion = page.getByRole('heading', { name: 'Carga de los próximos 14 días' }).locator('..')
    await expect(seccion).toContainText('Sin límite diario configurado.')
    await expect(seccion.getByRole('link', { name: 'Definir capacidad' })).toBeVisible()
  })
})
