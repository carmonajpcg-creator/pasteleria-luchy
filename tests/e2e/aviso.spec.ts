import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockSupabase, utcDaysFromNow } from './helpers'

// Auditoría Fase 10 (A7): con catálogo de ejemplo y WhatsApp real, el aviso del sitio se ve en todas las
// páginas y encabeza el mensaje de WhatsApp para que la tienda distinga esos pedidos.
const AVISO = 'Sitio en preparación: productos, fotos y precios son de ejemplo.'

test('sin aviso configurado no aparece ningún banner', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/#/')
  await expect(page.getByRole('heading', { level: 1, name: 'Pastelería Luchy' })).toBeVisible()
  await expect(page.getByText(AVISO)).toHaveCount(0)
})

test('el aviso aparece en todas las páginas públicas y pasa axe', async ({ page }) => {
  await mockSupabase(page, { demoNotice: AVISO })
  for (const ruta of ['/#/', '/#/catalogo', '/#/producto/pastel-tres-leches', '/#/carrito', '/#/contacto']) {
    await page.goto(ruta)
    await expect(page.getByRole('note').filter({ hasText: AVISO })).toBeVisible()
  }
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(r.violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})

test('el mensaje de WhatsApp empieza con el aviso del sitio', async ({ page }) => {
  await mockSupabase(page, { demoNotice: AVISO })
  await page.context().route('https://wa.me/**', (r) => r.abort())
  await page.goto('/#/producto/cupcake-vainilla')
  await page.getByRole('button', { name: 'Agregar al carrito' }).click()
  await page.goto('/#/checkout')
  await page.getByLabel('Nombre').fill('Ana López')
  await page.getByLabel('Teléfono / WhatsApp').fill('55 1234 5678')
  await page.getByLabel('Fecha solicitada').fill(utcDaysFromNow(10))
  await page.getByRole('checkbox', { name: /Acepto el aviso de privacidad/ }).check()
  await page.getByRole('button', { name: 'Registrar pedido' }).click()
  const href = await page.getByRole('link', { name: /Continuar a WhatsApp/ }).getAttribute('href')
  const texto = new URL(href!).searchParams.get('text')!
  expect(texto.split('\n')[0]).toBe(`(Aviso del sitio: ${AVISO})`)
  expect(texto).toContain('Hola, quiero confirmar mi pedido L-TEST001.')
})
