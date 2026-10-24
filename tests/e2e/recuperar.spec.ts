import { expect, test } from '@playwright/test'
import { ADMIN, mockAdmin } from './adminHelpers'
import { mockSupabase } from './helpers'

test.describe('recuperar contraseña', () => {
  test('desde el login se pide el correo y se envía el enlace con regreso a la raíz del sitio', async ({ page }) => {
    await mockSupabase(page)
    const { calls } = await mockAdmin(page)
    await page.goto('/#/admin/login')
    // Solo se ofrece tras equivocarse de contraseña, no de entrada.
    await expect(page.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveCount(0)
    await page.getByLabel('Correo').fill(ADMIN.email)
    await page.getByLabel('Contraseña').fill('incorrecta')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible()
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Recuperar contraseña' })).toBeVisible()

    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByText('Escribe tu correo')).toBeVisible()
    expect(calls.recover).toEqual([])

    await page.getByLabel('Correo').fill(ADMIN.email)
    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByRole('status')).toContainText('Revisa tu correo')
    expect(calls.recover).toHaveLength(1)
    expect(calls.recover[0]!.email).toBe(ADMIN.email)
    expect(calls.recover[0]!.redirectTo).toMatch(/^http:\/\/[^/]+\/$/) // sin «#»: el código PKCE llega en la query
  })

  test('el enlace del correo (?code=) abre la pantalla de nueva contraseña, no la tienda', async ({ page }) => {
    await mockSupabase(page)
    await mockAdmin(page)
    await page.goto('/?code=abc123')
    await expect(page).toHaveURL(/#\/admin\/restablecer$/)
  })

  test('sin sesión de recuperación, avisa que el enlace no es válido', async ({ page }) => {
    await mockSupabase(page)
    await mockAdmin(page)
    await page.goto('/#/admin/restablecer')
    await expect(page.getByRole('heading', { level: 1, name: 'Enlace no válido' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Recuperar contraseña' })).toBeVisible()
  })

  test('con sesión: valida longitud y coincidencia, y guarda la nueva contraseña', async ({ page }) => {
    await mockSupabase(page)
    const { calls } = await mockAdmin(page)
    await page.goto('/#/admin/login')
    await page.getByLabel('Correo').fill(ADMIN.email)
    await page.getByLabel('Contraseña').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Panel administrativo' })).toBeVisible()
    await page.goto('/#/admin/restablecer')

    await page.getByLabel('Contraseña nueva').fill('corta')
    await page.getByLabel('Repite la contraseña').fill('corta')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByText('Usa al menos 12 caracteres')).toBeVisible()

    await page.getByLabel('Contraseña nueva').fill('una-clave-larga-1')
    await page.getByLabel('Repite la contraseña').fill('una-clave-larga-2')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible()
    expect(calls.passwordUpdates).toEqual([])

    await page.getByLabel('Repite la contraseña').fill('una-clave-larga-1')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Panel administrativo' })).toBeVisible()
    expect(calls.passwordUpdates).toEqual(['una-clave-larga-1'])
  })
})
