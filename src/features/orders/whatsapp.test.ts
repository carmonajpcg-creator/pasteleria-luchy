import { buildWhatsAppMessage, buildWhatsAppUrl, type WhatsAppOrder } from './whatsapp'

const order: WhatsAppOrder = {
  folio: 'L-ABC1234',
  items: [
    { name: 'Cupcake de vainilla', quantity: 2, lineTotalCents: 9000 },
    { name: 'Pastel de tres leches', quantity: 1, lineTotalCents: 60000, customization: 'Feliz cumpleaños Ana' },
  ],
  totalCents: 69000,
  fulfillment: 'pickup',
  requestedDate: '2026-10-25',
  customerName: 'Ana López',
  notes: 'Sin nueces & con "velas"',
}

describe('buildWhatsAppMessage', () => {
  const text = buildWhatsAppMessage(order)

  it('incluye folio, productos, cantidades, personalización y total', () => {
    expect(text).toContain('pedido L-ABC1234')
    expect(text).toContain('- 2 x Cupcake de vainilla — $90.00 MXN')
    expect(text).toContain('- 1 x Pastel de tres leches — $600.00 MXN (Personalización: Feliz cumpleaños Ana)')
    expect(text).toContain('Total estimado: $690.00 MXN')
  })

  it('incluye modalidad, fecha en español, nombre y notas', () => {
    expect(text).toContain('Modalidad: Recolección en tienda')
    expect(text).toContain('Fecha solicitada: 25 de octubre de 2026')
    expect(text).toContain('Nombre: Ana López')
    expect(text).toContain('Notas: Sin nueces & con "velas"')
  })

  it('aclara que el pedido no está confirmado y no incluye teléfono ni correo', () => {
    expect(text).toContain('queda confirmado cuando la tienda me responda')
    expect(text).not.toMatch(/tel[eé]fono|correo|@/i)
  })

  it('omite nombre y notas cuando no existen (pedido abierto en otro dispositivo)', () => {
    const minimal = buildWhatsAppMessage({ ...order, customerName: undefined, notes: undefined })
    expect(minimal).not.toContain('Nombre:')
    expect(minimal).not.toContain('Notas:')
  })
})

describe('buildWhatsAppUrl', () => {
  it('apunta a wa.me con el número y el texto codificado', () => {
    const text = buildWhatsAppMessage(order)
    const url = buildWhatsAppUrl('528787030104', text)
    expect(url.startsWith('https://wa.me/528787030104?text=')).toBe(true)
    expect(url).not.toMatch(/[\s"]/) // todo escapado
    expect(new URL(url).searchParams.get('text')).toBe(text) // ida y vuelta exacta
  })

  it('escapa caracteres que romperían la URL', () => {
    const url = buildWhatsAppUrl('52', 'a&b=c#d?e')
    expect(url).toBe('https://wa.me/52?text=a%26b%3Dc%23d%3Fe')
  })
})
