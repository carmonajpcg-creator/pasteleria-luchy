import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ADMIN, mockAdmin } from './adminHelpers'
import { mockSupabase } from './helpers'

async function enter(page: Page) {
  await mockSupabase(page)
  const mocks = await mockAdmin(page)
  await page.goto('/#/admin/login')
  await page.getByLabel('Correo').fill(ADMIN.email)
  await page.getByLabel('Contraseña').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Panel administrativo' })).toBeVisible()
  return mocks
}

test.describe('reporte de ventas', () => {
  test('muestra totales y tablas del periodo y descarga el CSV', async ({ page }) => {
    const { calls } = await enter(page)
    await page.getByRole('navigation', { name: 'Administración' }).getByRole('link', { name: 'Reportes' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Reporte de ventas' })).toBeVisible()

    await page.getByLabel('Desde').fill('2026-10-01')
    await page.getByLabel('Hasta').fill('2026-10-31')
    await expect(page.getByText('Pedidos confirmados', { exact: true })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Ventas por día' })).toContainText('600.00')
    await expect(page.getByRole('table', { name: 'Productos vendidos en el periodo' })).toContainText('1')
    expect(calls.reports.at(-1)).toEqual({ from: '2026-10-01', to: '2026-10-31' })

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar CSV' }).click()])
    expect(download.suggestedFilename()).toBe('ventas-2026-10-01_a_2026-10-31.csv')
  })

  test('un periodo sin ventas lo dice, y un rango invertido no consulta', async ({ page }) => {
    const { calls } = await enter(page)
    await page.goto('/#/admin/reportes')
    await page.getByLabel('Desde').fill('2026-01-01')
    await page.getByLabel('Hasta').fill('2026-01-31')
    await expect(page.getByText('Sin ventas confirmadas en este periodo.')).toBeVisible()

    const before = calls.reports.length
    await page.getByLabel('Hasta').fill('2025-12-01')
    await expect(page.getByRole('alert').filter({ hasText: 'Elige un periodo válido' })).toBeVisible()
    expect(calls.reports.length).toBe(before)
  })

  test('sin violaciones de accesibilidad (axe)', async ({ page }) => {
    await enter(page)
    await page.goto('/#/admin/reportes')
    await expect(page.getByRole('heading', { level: 1, name: 'Reporte de ventas' })).toBeVisible()
    await expect(page.getByText('Pedidos confirmados', { exact: true })).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(results.violations).toEqual([])
  })
})

test.describe('avisos de pedidos nuevos', () => {
  test('el menú muestra cuántos pedidos esperan contacto y la pestaña lo antepone al título', async ({ page }) => {
    await enter(page)
    await expect(page.getByRole('navigation', { name: 'Administración' }).getByRole('link', { name: /Pedidos.*1 pedidos pendientes de contacto/ })).toBeVisible()
    await expect(page).toHaveTitle(/^\(1\) /)
    await page.goto('/#/admin/productos')
    await expect(page).toHaveTitle(/^\(1\) Productos/)
  })

  test('activar los avisos se recuerda y cambia el botón', async ({ page }) => {
    await enter(page)
    await page.getByRole('button', { name: 'Activar avisos de pedidos' }).click()
    await expect(page.getByRole('button', { name: 'Avisos de pedidos: activados' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Avisos de pedidos: activados' })).toBeVisible()
  })
})
