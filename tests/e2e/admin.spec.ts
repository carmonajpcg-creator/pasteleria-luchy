import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ADMIN, mockAdmin, NO_ROLE, type AdminOptions } from './adminHelpers'
import { mockSupabase } from './helpers'

const wcag = ['wcag2a', 'wcag2aa', 'wcag21aa']
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function setup(page: Page, options: AdminOptions = {}) {
  await mockSupabase(page)
  return mockAdmin(page, options)
}

async function login(page: Page, user = ADMIN) {
  await page.goto('/#/admin/login')
  await page.getByLabel('Correo').fill(user.email)
  await page.getByLabel('Contraseña').fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

async function loginAndGo(page: Page, path: string, user = ADMIN) {
  await login(page, user)
  await expect(page.getByRole('heading', { level: 1, name: 'Panel administrativo' })).toBeVisible()
  await page.goto(`/#${path}`)
}

// Fila de un producto en el inventario (se espera a que cargue la pantalla: el cambio de ruta es diferido).
async function stockRow(page: Page, nombre: string) {
  await expect(page.getByRole('heading', { level: 1, name: 'Inventario' })).toBeVisible()
  return page.getByRole('listitem').filter({ hasText: 'en existencia' }).filter({ hasText: nombre })
}

test.describe('acceso', () => {
  // E09: sin sesión no se llega al panel y ni siquiera se piden datos privados.
  test('E09: un visitante anónimo es enviado al login y no se hace ninguna petición privada', async ({ page }) => {
    await setup(page)
    const privadas: string[] = []
    page.on('request', (r) => /admin_dashboard|\/rest\/v1\/(orders|payments|inventory_movements)/.test(r.url()) && privadas.push(r.url()))

    for (const ruta of ['/#/admin', '/#/admin/pedidos', '/#/admin/productos/nuevo', '/#/admin/configuracion']) {
      await page.goto(ruta)
      await expect(page).toHaveURL(/#\/admin\/login$/)
      await expect(page.getByRole('heading', { level: 1, name: 'Acceso administrador' })).toBeVisible()
    }
    expect(privadas).toEqual([])
  })

  test('desde la tienda: «Iniciar sesión» lleva al login y, tras entrar, al panel de pedidos', async ({ page }) => {
    await setup(page)
    await page.goto('/#/')
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Iniciar sesión' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Acceso administrador' })).toBeVisible()
    await page.getByLabel('Correo').fill(ADMIN.email)
    await page.getByLabel('Contraseña').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Panel administrativo' })).toBeVisible()
    await page.getByRole('navigation', { name: 'Administración' }).getByRole('link', { name: 'Pedidos' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeVisible()

    // Con la sesión abierta, el mismo enlace del encabezado abre el panel directamente.
    await page.getByRole('link', { name: 'Ver tienda' }).click()
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Consola de pedidos' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeVisible()
  })

  test('el encabezado de la tienda cambia: «Iniciar sesión» sin sesión y «Consola de pedidos» con ella', async ({ page }) => {
    await setup(page)
    const nav = page.getByRole('navigation', { name: 'Principal' })

    // Sin sesión: se ofrece iniciar sesión y no la consola.
    await page.goto('/#/catalogo')
    await expect(nav.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Consola de pedidos' })).toHaveCount(0)
    await nav.getByRole('link', { name: 'Iniciar sesión' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Acceso administrador' })).toBeVisible()

    // Tras entrar, en la tienda el mismo lugar muestra la consola, que abre la lista de pedidos.
    await page.getByLabel('Correo').fill(ADMIN.email)
    await page.getByLabel('Contraseña').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Panel administrativo' })).toBeVisible()
    await page.getByRole('link', { name: 'Ver tienda' }).click()
    await expect(nav.getByRole('link', { name: 'Consola de pedidos' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Iniciar sesión' })).toHaveCount(0)
    await page.goto('/#/catalogo') // también tras recargar la página (la sesión se conserva)
    await page.reload()
    await expect(nav.getByRole('link', { name: 'Consola de pedidos' })).toBeVisible()
    await nav.getByRole('link', { name: 'Consola de pedidos' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'L-ADMIN01' })).toBeVisible()

    // Al cerrar sesión vuelve «Iniciar sesión».
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await page.getByRole('link', { name: 'Ver tienda' }).or(page.getByRole('link', { name: 'Volver a la tienda' })).click()
    await expect(nav.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Consola de pedidos' })).toHaveCount(0)
  })

  test('un usuario sin rol que abre la «Consola de pedidos» ve «Sin permisos» (el enlace no da acceso)', async ({ page }) => {
    await setup(page)
    await page.goto('/#/admin/login')
    await page.getByLabel('Correo').fill(NO_ROLE.email)
    await page.getByLabel('Contraseña').fill(NO_ROLE.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Sin permisos' })).toBeVisible()
    await page.goto('/#/')
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Consola de pedidos' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Sin permisos' })).toBeVisible()
  })

  test('credenciales incorrectas muestran un error y no dan acceso', async ({ page }) => {
    await setup(page)
    await page.goto('/#/admin/login')
    await page.getByLabel('Correo').fill(ADMIN.email)
    await page.getByLabel('Contraseña').fill('incorrecta')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Correo o contraseña incorrectos.' })).toBeVisible()
    await expect(page).toHaveURL(/#\/admin\/login$/)
  })

  test('el formulario valida campos vacíos', async ({ page }) => {
    await setup(page)
    await page.goto('/#/admin/login')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Escribe tu correo')).toBeVisible()
    await expect(page.getByText('Escribe tu contraseña')).toBeVisible()
    await expect(page.getByLabel('Correo')).toHaveAttribute('aria-invalid', 'true')
  })

  test('E09: un usuario sin rol ve «Sin permisos» y no se piden datos del panel', async ({ page }) => {
    await setup(page)
    const privadas: string[] = []
    page.on('request', (r) => /admin_dashboard|\/rest\/v1\/(orders|payments)/.test(r.url()) && privadas.push(r.url()))
    await login(page, NO_ROLE)
    await expect(page.getByRole('heading', { level: 1, name: 'Sin permisos' })).toBeVisible()
    await page.goto('/#/admin/pedidos')
    await expect(page.getByRole('heading', { level: 1, name: 'Sin permisos' })).toBeVisible()
    expect(privadas).toEqual([])

    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/#\/admin\/login$/)
  })

  test('la sesión sobrevive a una recarga y se cierra con «Cerrar sesión»', async ({ page }) => {
    await setup(page)
    await loginAndGo(page, '/admin/pedidos')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeVisible()

    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/#\/admin\/login$/)
    await page.goto('/#/admin/pedidos')
    await expect(page).toHaveURL(/#\/admin\/login$/)
  })

  test('el panel pide no ser indexado y el sitio público no descarga código del panel', async ({ page }) => {
    await setup(page)
    const chunks: string[] = []
    page.on('request', (r) => /Admin|Dashboard|RequireAdmin|Orders|Inventory/.test(new URL(r.url()).pathname) && chunks.push(r.url()))

    await page.goto('/#/')
    await expect(page.getByRole('heading', { level: 1, name: 'Pastelería Luchy' })).toBeVisible()
    await page.goto('/#/catalogo')
    await expect(page.getByRole('heading', { level: 1, name: 'Catálogo' })).toBeVisible()
    expect(chunks).toEqual([])
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)

    await page.goto('/#/admin/login')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })
})

test.describe('panel y pedidos', () => {
  test('el dashboard resume pedidos, dinero y stock bajo', async ({ page }) => {
    await setup(page)
    await loginAndGo(page, '/admin')
    await expect(page.getByRole('link', { name: /Pendiente de confirmar por la tienda/ })).toContainText('1')
    await expect(page.getByRole('link', { name: /^1 Confirmado/ })).toBeVisible()
    await expect(page.getByText('Ventas confirmadas').locator('..')).toContainText('$600.00 MXN')
    const bajo = page.getByRole('heading', { name: 'Productos con stock bajo' }).locator('..')
    await expect(bajo).toContainText('Cupcake de chocolate')
    await expect(bajo).not.toContainText('Cupcake de vainilla')
  })

  test('la bandeja filtra por estado y busca por folio', async ({ page }) => {
    await setup(page)
    await loginAndGo(page, '/admin/pedidos')
    await expect(page.getByRole('status').filter({ hasText: 'pedidos' })).toHaveText('2 pedidos')

    await page.getByLabel('Estado').selectOption('confirmed')
    await expect(page.getByRole('status').filter({ hasText: 'pedido' })).toHaveText('1 pedido')
    await expect(page.getByRole('link', { name: 'L-ADMIN02' })).toBeVisible()

    await page.getByLabel('Estado').selectOption('')
    await page.getByLabel('Buscar por folio').fill('admin01')
    await expect(page.getByRole('link', { name: 'L-ADMIN01' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'L-ADMIN02' })).toHaveCount(0)
  })

  test('E10: confirmar descuenta inventario una sola vez aunque se haga doble clic', async ({ page }) => {
    const { calls } = await setup(page, { confirmDelayMs: 600 })
    await loginAndGo(page, '/admin/pedidos')
    await page.getByRole('link', { name: 'L-ADMIN01' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Pedido L-ADMIN01' })).toBeVisible()
    await expect(page.getByText('Ana López')).toBeVisible() // datos de contacto solo para el admin

    await page.getByRole('button', { name: 'Confirmar pedido' }).dblclick()
    await expect(page.getByText(/Estado:/)).toContainText('Confirmado')
    expect(calls.confirmOrder).toEqual(['o1'])
    await expect(page.getByText('Descuento por confirmación')).toBeVisible()

    await page.goto('/#/admin/inventario')
    await expect(await stockRow(page, 'Cupcake de vainilla')).toContainText('10 en existencia')
  })

  test('E11: cancelar un pedido confirmado exige motivo y repone el inventario', async ({ page }) => {
    const { calls } = await setup(page)
    await loginAndGo(page, '/admin/pedidos')
    await page.getByRole('link', { name: 'L-ADMIN01' }).click()
    await page.getByRole('button', { name: 'Confirmar pedido' }).click()
    await expect(page.getByText(/Estado:/)).toContainText('Confirmado')

    await page.getByRole('button', { name: 'Cancelar y reponer inventario' }).click()
    const confirmar = page.getByRole('button', { name: 'Confirmar cancelación' })
    await expect(confirmar).toBeDisabled() // sin motivo
    await page.getByLabel('Motivo de la cancelación').fill('ab')
    await expect(confirmar).toBeDisabled()
    await page.getByLabel('Motivo de la cancelación').fill('Cliente no respondió')
    await confirmar.click()

    await expect(page.getByText(/Estado:/)).toContainText('Cancelado')
    await expect(page.getByText('Cliente no respondió').first()).toBeVisible()
    expect(calls.cancelOrder).toEqual([{ id: 'o1', reason: 'Cliente no respondió' }])
    await expect(page.getByText('Reposición por cancelación')).toBeVisible()

    await page.goto('/#/admin/inventario')
    await expect(await stockRow(page, 'Cupcake de vainilla')).toContainText('12 en existencia')
  })

  test('el pedido avanza: preparación → listo → entregado y luego ya no hay acciones', async ({ page }) => {
    const { calls } = await setup(page)
    await loginAndGo(page, '/admin/pedidos')
    await page.getByRole('link', { name: 'L-ADMIN02' }).click()
    for (const [boton, estado] of [
      ['Pasar a preparación', 'En preparación'],
      ['Marcar como listo', 'Listo'],
      ['Marcar como entregado', 'Entregado'],
    ] as const) {
      await page.getByRole('button', { name: boton }).click()
      await expect(page.getByText(/Estado:/)).toContainText(estado)
    }
    expect(calls.advanceOrder.map((a) => a.to)).toEqual(['in_preparation', 'ready', 'delivered'])
    await expect(page.getByRole('heading', { name: 'Acciones' })).toHaveCount(0)
  })

  test('pagos manuales: anticipo, saldo, validación y reembolso mayor al pagado', async ({ page }) => {
    const { calls } = await setup(page)
    await loginAndGo(page, '/admin/pedidos')
    await page.getByRole('link', { name: 'L-ADMIN01' }).click()

    await page.getByLabel('Importe (MXN)').fill('12.345')
    await page.getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect(page.getByText(/importe mayor a cero, con hasta 2 decimales/)).toBeVisible()
    expect(calls.payments).toHaveLength(0)

    await page.getByLabel('Importe (MXN)').fill('40')
    await page.getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect(page.getByText(/Pago:/)).toContainText('Anticipo registrado')
    await expect(page.getByText('Saldo pendiente').locator('..')).toContainText('$50.00 MXN')
    expect(calls.payments[0]).toMatchObject({ order_id: 'o1', amount_cents: 4000, is_refund: false, method: 'transfer' })

    await page.getByLabel('Tipo').selectOption('refund')
    await page.getByLabel('Importe (MXN)').fill('100')
    await page.getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Los reembolsos superan lo pagado' })).toBeVisible()

    await page.getByLabel('Importe (MXN)').fill('50')
    await page.getByLabel('Tipo').selectOption('payment')
    await page.getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect(page.getByText(/Pago:/)).toContainText('Pagado')
  })
})

test.describe('catálogo, inventario y configuración', () => {
  test('crea un producto: precio en pesos → centavos, slug automático y sin stock directo', async ({ page }) => {
    const { calls } = await setup(page)
    await loginAndGo(page, '/admin/productos/nuevo')
    await page.getByLabel('Nombre', { exact: true }).fill('Pastel de nuez')
    await expect(page.getByLabel('Clave de URL')).toHaveValue('pastel-de-nuez')
    await page.getByLabel('SKU').fill('PAS-777')
    await page.getByLabel('Categoría').selectOption({ label: 'Pasteles' })
    await page.getByLabel('Precio (MXN)').fill('123.45')
    await page.getByLabel('Alérgenos', { exact: true }).fill('nueces, gluten')
    await page.getByRole('button', { name: 'Crear producto' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Pastel de nuez' })).toBeVisible()
    await expect(page).toHaveURL(/#\/admin\/productos\/np100$/)
    const body = calls.productWrites[0]!.body
    expect(body).toMatchObject({ price_cents: 12345, slug: 'pastel-de-nuez', category_id: 'c1', allergens: ['nueces', 'gluten'], active: true })
    expect(body).not.toHaveProperty('stock_quantity')
    await expect(page.getByRole('heading', { name: 'Imágenes' })).toBeVisible()
  })

  test('valida el formulario de producto y traduce el error de SKU duplicado', async ({ page }) => {
    const { calls } = await setup(page)
    await loginAndGo(page, '/admin/productos/nuevo')
    await page.getByRole('button', { name: 'Crear producto' }).click()
    await expect(page.getByText('Escribe el nombre')).toBeVisible()
    await expect(page.getByText('Escribe el SKU')).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'Elige una categoría' })).toBeVisible()
    await expect(page.getByText(/precio válido/)).toBeVisible()
    expect(calls.productWrites).toHaveLength(0)

    await page.getByLabel('Nombre', { exact: true }).fill('Otro pastel')
    await page.getByLabel('SKU').fill('PAS-004') // ya existe
    await page.getByLabel('Categoría').selectOption({ label: 'Pasteles' })
    await page.getByLabel('Precio (MXN)').fill('10')
    await page.getByRole('button', { name: 'Crear producto' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Ya existe un registro con ese valor' })).toBeVisible()
  })

  test('edita y desactiva un producto (no se borra)', async ({ page }) => {
    const { calls } = await setup(page)
    await loginAndGo(page, '/admin/productos')
    await page.getByRole('link', { name: 'Pastel de tres leches' }).click()
    await expect(page.getByLabel('Precio (MXN)')).toHaveValue('600.00')
    await page.getByLabel('Precio (MXN)').fill('650')
    await page.getByLabel(/Activo \(visible/).uncheck()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect.poll(() => calls.productWrites.length).toBe(1)
    expect(calls.productWrites[0]).toMatchObject({ method: 'PATCH', body: { price_cents: 65000, active: false } })
    await expect(page.getByRole('button', { name: /Borrar|Eliminar producto/ })).toHaveCount(0)
  })

  test('imágenes: rechaza tipos y tamaños inválidos, sube y elimina una imagen válida', async ({ page }) => {
    const { calls } = await setup(page)
    await loginAndGo(page, '/admin/productos')
    await page.getByRole('link', { name: 'Cupcake de vainilla' }).click()
    const input = page.getByLabel('Agregar imagen')

    await input.setInputFiles({ name: 'animado.gif', mimeType: 'image/gif', buffer: PNG })
    await expect(page.getByRole('alert').filter({ hasText: 'JPG, PNG o WebP' })).toBeVisible()
    await input.setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) })
    await expect(page.getByRole('alert').filter({ hasText: '2 MB' })).toBeVisible()
    expect(calls.uploads).toHaveLength(0)

    await input.setInputFiles({ name: 'foto original.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByRole('button', { name: 'Eliminar imagen' })).toBeVisible()
    expect(calls.uploads).toHaveLength(1)
    expect(calls.uploads[0]).toMatch(/products\/p3\/[0-9a-f-]{36}\.png$/) // nombre aleatorio, no el original

    page.once('dialog', (d) => void d.accept())
    await page.getByRole('button', { name: 'Eliminar imagen' }).click()
    await expect(page.getByRole('button', { name: 'Eliminar imagen' })).toHaveCount(0)
    expect(calls.removed).toHaveLength(1)
  })

  test('un fallo de subida muestra el error y no registra la imagen', async ({ page }) => {
    await setup(page, { uploadFails: true })
    await loginAndGo(page, '/admin/productos')
    await page.getByRole('link', { name: 'Cupcake de vainilla' }).click()
    await page.getByLabel('Agregar imagen').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByRole('alert').filter({ hasText: 'Ocurrió un error inesperado' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Eliminar imagen' })).toHaveCount(0)
  })

  test('categorías: crear, y no se puede borrar una con productos', async ({ page }) => {
    const { calls } = await setup(page)
    await loginAndGo(page, '/admin/categorias')
    await page.getByRole('button', { name: 'Nueva categoría' }).click()
    await page.getByLabel('Nombre').fill('Galletas')
    await expect(page.getByLabel('Clave de URL')).toHaveValue('galletas')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByText('/galletas')).toBeVisible()
    expect(calls.categoryWrites[0]).toMatchObject({ method: 'POST', body: { name: 'Galletas', slug: 'galletas', sort_order: 0, active: true } })

    page.once('dialog', (d) => void d.accept())
    await page.getByRole('button', { name: 'Borrar Pasteles' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'hay registros relacionados' })).toBeVisible()

    page.once('dialog', (d) => void d.accept())
    await page.getByRole('button', { name: 'Borrar Galletas' }).click()
    await expect(page.getByText('/galletas')).toHaveCount(0)
  })

  test('inventario: merma resta, historial visible y un ajuste que dejaría negativo se rechaza', async ({ page }) => {
    const { calls } = await setup(page)
    await loginAndGo(page, '/admin/inventario')
    const fila = await stockRow(page, 'Cupcake de vainilla')
    await expect(fila).toContainText('12 en existencia')
    await expect(await stockRow(page, 'Cupcake de chocolate')).toContainText('stock bajo')

    await fila.getByRole('button', { name: 'Ajustar Cupcake de vainilla' }).click()
    await page.getByLabel('Motivo').selectOption('waste')
    await page.getByLabel('Cantidad').fill('0')
    await page.getByRole('button', { name: 'Registrar movimiento' }).click()
    await expect(page.getByText('Escribe un número entero mayor a cero')).toBeVisible()
    expect(calls.adjustStock).toHaveLength(0)

    await page.getByLabel('Cantidad').fill('2')
    await page.getByLabel('Nota (opcional)').fill('Se cayeron')
    await page.getByRole('button', { name: 'Registrar movimiento' }).click()
    await expect(fila).toContainText('10 en existencia')
    expect(calls.adjustStock[0]).toMatchObject({ p_product_id: 'p3', p_delta: -2, p_reason: 'waste', p_note: 'Se cayeron' })
    // El historial está dentro del elemento de la fila: el último coincidente es el más interno.
    await expect(page.getByRole('listitem').filter({ hasText: 'Se cayeron' }).last()).toContainText('-2')

    await page.getByLabel('Motivo').selectOption('adjustment')
    await page.getByLabel('Dirección').selectOption('subtract')
    await page.getByLabel('Cantidad').fill('50')
    await page.getByRole('button', { name: 'Registrar movimiento' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'no pueden quedar en negativo' })).toBeVisible()
    await expect(fila).toContainText('10 en existencia')
  })

  test('configuración: cambiar el WhatsApp exige confirmación y valida formato y zona horaria', async ({ page }) => {
    const { calls } = await setup(page)
    await loginAndGo(page, '/admin/configuracion')
    await expect(page.getByLabel('WhatsApp de la tienda')).toHaveValue('525500000000')

    await page.getByLabel('WhatsApp de la tienda').fill('+528787030104')
    await page.getByRole('button', { name: 'Guardar configuración' }).click()
    await expect(page.getByText(/Solo dígitos, con código de país/)).toBeVisible()

    await page.getByLabel('WhatsApp de la tienda').fill('528787030104')
    const guardar = page.getByRole('button', { name: 'Guardar configuración' })
    await guardar.click() // falta confirmar el cambio de número
    await expect(page.getByRole('alert').filter({ hasText: 'Marca la casilla para confirmar' })).toBeVisible()
    expect(calls.settingsPatches).toHaveLength(0)
    await page.getByRole('checkbox', { name: /Confirmo que este es el número correcto/ }).check()

    await page.getByLabel('Zona horaria').fill('No/Existe')
    await guardar.click()
    await expect(page.getByText(/Zona horaria no válida/)).toBeVisible()
    expect(calls.settingsPatches).toHaveLength(0)

    await page.getByLabel('Zona horaria').fill('America/Matamoros')
    await guardar.click()
    await expect(page.getByText('Cambios guardados.')).toBeVisible()
    expect(calls.settingsPatches[0]).toMatchObject({ whatsapp_number: '528787030104', timezone: 'America/Matamoros', order_expiry_hours: 48 })
  })
})

test.describe('revisión Opus', () => {
  test('H1: con sesión de admin, la tienda pública no muestra categorías inactivas', async ({ page }) => {
    await setup(page)
    await loginAndGo(page, '/admin/categorias')
    await page.getByRole('button', { name: 'Editar Cupcakes' }).click()
    await page.getByLabel(/Activa \(visible/).uncheck()
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByText(/cupcakes · orden 2 · Inactiva/)).toBeVisible()

    const consultas: string[] = []
    page.on('request', (r) => r.url().includes('/rest/v1/categories') && consultas.push(r.url()))
    await page.goto('/#/catalogo')
    await expect(page.getByRole('button', { name: 'Pasteles' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cupcakes' })).toHaveCount(0)
    expect(consultas.every((u) => u.includes('active=eq.true'))).toBe(true)
  })

  test('H4: con más de 100 pedidos la bandeja avisa que muestra solo los recientes', async ({ page }) => {
    await setup(page, { extraOrders: 120 })
    await loginAndGo(page, '/admin/pedidos')
    await expect(page.getByRole('status').filter({ hasText: 'Mostrando los 100 pedidos más recientes' })).toBeVisible()
    await page.getByLabel('Buscar por folio').fill('L-HIST119')
    await expect(page.getByRole('link', { name: 'L-HIST119' })).toBeVisible()
  })
})

test.describe('accesibilidad y diseño', () => {
  const pantallas: [string, string][] = [
    ['/admin', 'Panel administrativo'],
    ['/admin/pedidos', 'Pedidos'],
    ['/admin/pedidos/o1', 'Pedido L-ADMIN01'],
    ['/admin/productos', 'Productos'],
    ['/admin/productos/nuevo', 'Nuevo producto'],
    ['/admin/productos/p3', 'Cupcake de vainilla'],
    ['/admin/categorias', 'Categorías'],
    ['/admin/inventario', 'Inventario'],
    ['/admin/configuracion', 'Configuración'],
  ]

  test('login sin violaciones de accesibilidad (axe)', async ({ page }) => {
    await setup(page)
    await page.goto('/#/admin/login')
    await expect(page.getByRole('heading', { level: 1, name: 'Acceso administrador' })).toBeVisible()
    await page.getByRole('button', { name: 'Entrar' }).click() // con errores visibles
    await expect(page.getByText('Escribe tu correo')).toBeVisible()
    const r = await new AxeBuilder({ page }).withTags(wcag).analyze()
    expect(r.violations).toEqual([])
  })

  // Una prueba por pantalla: corren en paralelo y, si alguna falla, el nombre dice cuál.
  for (const [ruta, titulo] of pantallas) {
    test(`${ruta}: axe WCAG A/AA y sin desbordamiento horizontal`, async ({ page }) => {
      await setup(page)
      await loginAndGo(page, ruta)
      await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
      await page.waitForLoadState('networkidle')
      const r = await new AxeBuilder({ page }).withTags(wcag).analyze()
      expect(r.violations, ruta).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `${ruta} desborda`).toBe(false)
    })
  }

  test('inventario con el panel de ajuste abierto y categorías en edición: axe', async ({ page }) => {
    await setup(page)
    await loginAndGo(page, '/admin/inventario')
    await expect(await stockRow(page, 'Cupcake de vainilla')).toBeVisible()
    await page.getByRole('button', { name: 'Ajustar Cupcake de vainilla' }).click()
    await expect(page.getByRole('heading', { name: /Ajustar inventario/ })).toBeVisible()
    let r = await new AxeBuilder({ page }).withTags(wcag).analyze()
    expect(r.violations, 'ajuste').toEqual([])

    await page.goto('/#/admin/categorias')
    await page.getByRole('button', { name: 'Editar Pasteles' }).click()
    await expect(page.getByRole('heading', { name: /Editar categoría/ })).toBeVisible()
    r = await new AxeBuilder({ page }).withTags(wcag).analyze()
    expect(r.violations, 'categoría').toEqual([])
  })
})
