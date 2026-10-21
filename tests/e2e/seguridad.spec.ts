import { expect, test, type Page } from '@playwright/test'
import { ADMIN, mockAdmin } from './adminHelpers'
import { mockSupabase, utcDaysFromNow } from './helpers'

// Fase 9: la política de seguridad de contenido (CSP) del build y la protección del panel.

const cspViolations = (page: Page) => {
  const found: string[] = []
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to (load|execute|apply|connect)/i.test(m.text())) found.push(m.text())
  })
  return found
}

test('el build declara una CSP estricta con el origen de Supabase', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/#/')
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(csp).toBeTruthy()
  for (const directive of [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "connect-src 'self' http://supabase.test",
  ]) {
    expect(csp, directive).toContain(directive)
  }
  expect(csp).not.toContain('unsafe-inline')
  expect(csp).not.toContain('unsafe-eval')
  // Debe ser lo primero del <head> para aplicar a todo lo que sigue.
  const first = await page.evaluate(() => document.head.firstElementChild?.getAttribute('http-equiv'))
  expect(first).toBe('Content-Security-Policy')
})

test('el recorrido completo de compra no genera violaciones de CSP', async ({ page }) => {
  const violations = cspViolations(page)
  await mockSupabase(page)
  await page.goto('/#/')
  await expect(page.getByRole('heading', { level: 1, name: 'Pastelería Luchy' })).toBeVisible()
  await page.goto('/#/catalogo')
  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible()
  await page.goto('/#/producto/pastel-tres-leches')
  await page.getByLabel('Personalización (opcional)').fill('Feliz día')
  await page.getByRole('button', { name: 'Agregar al carrito' }).click()
  await page.goto('/#/carrito')
  await expect(page.getByRole('complementary')).toBeVisible()
  await page.goto('/#/checkout')
  await page.getByLabel('Nombre').fill('Ana López')
  await page.getByLabel('Teléfono / WhatsApp').fill('55 1234 5678')
  await page.getByLabel('Fecha solicitada').fill(utcDaysFromNow(10))
  await page.getByRole('checkbox', { name: /Acepto el aviso de privacidad/ }).check()
  await page.getByRole('button', { name: 'Registrar pedido' }).click()
  await expect(page.getByRole('link', { name: /Continuar a WhatsApp/ })).toBeVisible()
  await page.goto('/#/contacto')
  await expect(page.getByRole('heading', { level: 1, name: 'Contacto' })).toBeVisible()
  expect(violations).toEqual([])
})

test('el panel no genera violaciones de CSP', async ({ page }) => {
  const violations = cspViolations(page)
  await mockSupabase(page)
  await mockAdmin(page)
  await page.goto('/#/admin/login')
  await page.getByLabel('Correo').fill(ADMIN.email)
  await page.getByLabel('Contraseña').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  for (const [ruta, titulo] of [
    ['/admin', 'Panel administrativo'],
    ['/admin/pedidos/o1', 'Pedido L-ADMIN01'],
    ['/admin/productos/p3', 'Cupcake de vainilla'],
    ['/admin/inventario', 'Inventario'],
    ['/admin/configuracion', 'Configuración'],
  ] as const) {
    await page.goto(`/#${ruta}`)
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
  }
  expect(violations).toEqual([])
})

test('el panel se niega a mostrarse dentro de otra página (clickjacking)', async ({ page, baseURL }) => {
  await mockSupabase(page)
  await page.setContent(`<iframe src="${baseURL}/#/admin/login" title="marco" width="800" height="600"></iframe>`)
  const frame = page.frameLocator('iframe[title="marco"]')
  await expect(frame.getByRole('heading', { name: 'Acceso bloqueado' })).toBeVisible()
  await expect(frame.getByLabel('Contraseña')).toHaveCount(0)
})

test('la tienda pública sí funciona dentro de un marco (no es necesario bloquearla)', async ({ page, baseURL }) => {
  await mockSupabase(page)
  await page.setContent(`<iframe src="${baseURL}/#/catalogo" title="marco" width="800" height="600"></iframe>`)
  await expect(page.frameLocator('iframe[title="marco"]').getByRole('heading', { level: 1, name: 'Catálogo' })).toBeVisible()
})
