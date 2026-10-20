import { makeCheckoutSchema, maxRequestedDate, minRequestedDate } from './schema'

const valid = {
  name: 'Ana López',
  phone: '55 1234 5678',
  email: '',
  fulfillment: 'pickup' as const,
  requestedDate: '2026-11-10',
  notes: '',
  privacy: true,
}
const schema = makeCheckoutSchema('2026-11-01')
const issue = (over: object) => {
  const r = schema.safeParse({ ...valid, ...over })
  return r.success ? null : r.error.issues[0]?.message
}

describe('esquema de checkout', () => {
  it('acepta datos válidos', () => {
    expect(schema.safeParse(valid).success).toBe(true)
  })
  it('exige nombre, teléfono y consentimiento', () => {
    expect(issue({ name: ' ' })).toMatch(/nombre/i)
    expect(issue({ phone: '123' })).toMatch(/teléfono/i)
    expect(issue({ phone: '--------' })).toMatch(/8 dígitos/)
    expect(issue({ privacy: false })).toMatch(/aviso de privacidad/)
  })
  it('valida correo opcional', () => {
    expect(issue({ email: 'sin-arroba' })).toMatch(/correo/i)
    expect(issue({ email: 'ana@correo.mx' })).toBeNull()
  })
  it('rechaza fechas antes de la mínima o muy lejanas', () => {
    expect(issue({ requestedDate: '2026-10-31' })).toMatch(/a partir del día/)
    expect(issue({ requestedDate: '2026-11-01' })).toBeNull()
    expect(issue({ requestedDate: '2027-03-01' })).toMatch(/lejana/)
    expect(issue({ requestedDate: '' })).toMatch(/fecha/i)
  })
  it('limita las notas a 1000 caracteres', () => {
    expect(issue({ notes: 'x'.repeat(1001) })).toMatch(/1000/)
  })
})

describe('fechas de pedido', () => {
  // Misma regla que create_order: ((now() + anticipación) at time zone tz)::date
  it('usa la zona horaria de la tienda, no la del navegador', () => {
    const now = new Date('2026-10-21T01:30:00Z') // 20/oct 19:30 en Ciudad de México
    expect(minRequestedDate(0, 'UTC', now)).toBe('2026-10-21')
    expect(minRequestedDate(0, 'America/Mexico_City', now)).toBe('2026-10-20')
  })
  it('suma la anticipación en horas', () => {
    const now = new Date('2026-10-20T15:00:00Z')
    expect(minRequestedDate(48, 'UTC', now)).toBe('2026-10-22')
    expect(minRequestedDate(25, 'UTC', now)).toBe('2026-10-21')
    expect(minRequestedDate(9, 'UTC', now)).toBe('2026-10-21')
  })
  it('una zona inválida no rompe la app', () => {
    expect(minRequestedDate(0, 'No/Existe', new Date(2026, 9, 20, 12))).toBe('2026-10-20')
  })
  it('el máximo es 90 días después del mínimo', () => {
    expect(maxRequestedDate('2026-11-01')).toBe('2027-01-30')
  })
})
