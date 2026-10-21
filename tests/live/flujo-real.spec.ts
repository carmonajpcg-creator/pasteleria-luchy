import { expect, test } from '@playwright/test'
import pg from 'pg'

// Recorrido completo contra el backend REAL de pruebas: cliente pide → admin confirma (descuenta stock),
// registra anticipo y cancela (repone stock). No abre WhatsApp. Borra lo que crea.
const enabled = process.env.LUCHY_ENTORNO === 'pruebas'
test.skip(!enabled, 'Solo con LUCHY_ENTORNO=pruebas (proyecto de pruebas).')

const CUSTOMER = 'Prueba E2E real'
const db = () => new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
let initialStock = 0

test.beforeAll(async () => {
  const c = db()
  await c.connect()
  initialStock = (await c.query("select stock_quantity s from public.products where sku = 'CUP-001'")).rows[0].s
  await c.end()
})

test.afterAll(async () => {
  if (!enabled) return
  const c = db()
  await c.connect()
  try {
    await c.query('begin')
    const ids = (await c.query('select id from public.orders where customer_name = $1', [CUSTOMER])).rows.map((r) => r.id)
    if (ids.length) {
      await c.query('alter table public.inventory_movements disable trigger inventory_movements_append_only')
      await c.query('alter table public.payments disable trigger payments_append_only')
      await c.query('delete from public.payments where order_id = any($1)', [ids])
      await c.query('delete from public.inventory_movements where order_id = any($1)', [ids])
      await c.query('delete from public.orders where id = any($1)', [ids])
      await c.query('alter table public.inventory_movements enable trigger inventory_movements_append_only')
      await c.query('alter table public.payments enable trigger payments_append_only')
    }
    await c.query('commit')
  } catch (e) {
    await c.query('rollback')
    throw e
  } finally {
    const left = (await c.query('select count(*)::int n from public.orders where customer_name = $1', [CUSTOMER])).rows[0].n
    const stock = (await c.query("select stock_quantity s from public.products where sku = 'CUP-001'")).rows[0].s
    await c.end()
    expect(left, 'pedidos de prueba restantes').toBe(0)
    expect(stock, 'stock final').toBe(initialStock)
  }
})

test('cliente pide, el admin confirma, cobra anticipo y cancela (backend real)', async ({ page }) => {
  const errores: string[] = []
  page.on('pageerror', (e) => errores.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
  // Ninguna petición sale hacia WhatsApp.
  await page.context().route('https://wa.me/**', (r) => r.abort())

  // --- Cliente
  await page.goto('/#/producto/cupcake-vainilla')
  await page.getByRole('button', { name: /Agregar una unidad de/ }).click()
  await page.getByRole('button', { name: 'Agregar al carrito' }).click()
  await page.goto('/#/checkout')
  await page.getByLabel('Nombre').fill(CUSTOMER)
  await page.getByLabel('Teléfono / WhatsApp').fill('55 7777 0001')
  await expect(page.getByText(/Primera fecha disponible/)).toBeVisible()
  const fecha = await page.getByLabel('Fecha solicitada').getAttribute('min')
  await page.getByLabel('Fecha solicitada').fill(fecha!)
  await page.getByRole('checkbox', { name: /Acepto el aviso de privacidad/ }).check()
  await page.getByRole('button', { name: 'Registrar pedido' }).click()
  await page.waitForURL(/#\/pedido\/L-/)
  const folio = decodeURIComponent(page.url().split('/pedido/')[1]!.split('?')[0]!)
  await expect(page.getByText(/Pendiente de confirmar por la tienda/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Continuar a WhatsApp/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=/)

  // --- Administrador
  await page.goto('/#/admin/login')
  await page.getByLabel('Correo').fill(process.env.LUCHY_ADMIN_EMAIL!)
  await page.getByLabel('Contraseña').fill(process.env.LUCHY_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Panel administrativo' })).toBeVisible()

  await page.goto('/#/admin/pedidos')
  await page.getByLabel('Buscar por folio').fill(folio)
  await page.getByRole('link', { name: folio }).click()
  await expect(page.getByRole('heading', { level: 1, name: `Pedido ${folio}` })).toBeVisible()
  await expect(page.getByText(CUSTOMER).first()).toBeVisible()

  await page.getByRole('button', { name: 'Confirmar pedido' }).click()
  await expect(page.getByText(/Estado:/)).toContainText('Confirmado')
  await expect(page.getByText('Descuento por confirmación')).toBeVisible()

  await page.getByLabel('Importe (MXN)').fill('20')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page.getByText(/Pago:/)).toContainText('Anticipo registrado')

  await page.goto('/#/admin/inventario')
  const fila = page.getByRole('listitem').filter({ hasText: 'en existencia' }).filter({ hasText: 'Cupcake de vainilla' })
  await expect(fila).toContainText(`${initialStock - 2} en existencia`)

  await page.goto('/#/admin/pedidos')
  await page.getByLabel('Buscar por folio').fill(folio)
  await page.getByRole('link', { name: folio }).click()
  await page.getByRole('button', { name: 'Cancelar y reponer inventario' }).click()
  await page.getByLabel('Motivo de la cancelación').fill('Prueba E2E automatizada')
  await page.getByRole('button', { name: 'Confirmar cancelación' }).click()
  await expect(page.getByText(/Estado:/)).toContainText('Cancelado')
  await expect(page.getByText('Reposición por cancelación')).toBeVisible()

  await page.goto('/#/admin/inventario')
  await expect(fila).toContainText(`${initialStock} en existencia`)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/#\/admin\/login$/)

  expect(errores).toEqual([])
})
