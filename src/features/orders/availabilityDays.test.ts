import {
  firstAvailableDay,
  nextAvailableAfter,
  reasonMessage,
  unavailableMap,
  type DayAvailability,
} from './availabilityDays'
import { makeCheckoutSchema } from './schema'

const day = (d: string, reason: DayAvailability['reason'] = null): DayAvailability => ({
  day: d,
  available: reason === null,
  reason,
})

// Hoy sin anticipación → dos días cerrados (domingo) → un día lleno → días libres.
const days: DayAvailability[] = [
  day('2026-11-01', 'past'),
  day('2026-11-02', 'lead'),
  day('2026-11-03'),
  day('2026-11-04', 'closed'),
  day('2026-11-05', 'full'),
  day('2026-11-06'),
  day('2026-11-07'),
]

describe('disponibilidad de fechas', () => {
  it('primer día disponible', () => {
    expect(firstAvailableDay(days)).toBe('2026-11-03')
    expect(firstAvailableDay([day('2026-11-01', 'past')])).toBeNull()
    expect(firstAvailableDay([])).toBeNull()
  })
  it('mapa de días no disponibles con su motivo', () => {
    expect(unavailableMap(days)).toEqual({
      '2026-11-01': 'past',
      '2026-11-02': 'lead',
      '2026-11-04': 'closed',
      '2026-11-05': 'full',
    })
  })
  it('siguiente día disponible después de una fecha (exclusivo)', () => {
    expect(nextAvailableAfter(days, '2026-11-04')).toBe('2026-11-06')
    expect(nextAvailableAfter(days, '2026-11-06')).toBe('2026-11-07')
    expect(nextAvailableAfter(days, '2026-11-07')).toBeNull()
  })
})

describe('esquema de checkout con disponibilidad del servidor', () => {
  const valid = {
    name: 'Ana López', phone: '55 1234 5678', email: '', fulfillment: 'pickup' as const,
    requestedDate: '2026-11-03', notes: '', privacy: true,
  }
  const schema = makeCheckoutSchema('2026-11-03', days)
  const issue = (requestedDate: string) => {
    const r = schema.safeParse({ ...valid, requestedDate })
    return r.success ? null : r.error.issues[0]?.message
  }

  it('acepta un día disponible', () => {
    expect(issue('2026-11-03')).toBeNull()
    expect(issue('2026-11-06')).toBeNull()
  })
  it('rechaza un día cerrado y sugiere el siguiente disponible', () => {
    expect(issue('2026-11-04')).toBe(`${reasonMessage.closed} Prueba con el 06/11/2026.`)
  })
  it('rechaza un día sin cupo y sugiere el siguiente disponible', () => {
    expect(issue('2026-11-05')).toBe(`${reasonMessage.full} Prueba con el 06/11/2026.`)
  })
  it('antes de la primera fecha disponible lo dice el mínimo', () => {
    expect(issue('2026-11-02')).toMatch(/a partir del día/)
  })
  it('sin respuesta del servidor solo aplican las reglas locales (el servidor decide)', () => {
    const offline = makeCheckoutSchema('2026-11-03', [])
    expect(offline.safeParse({ ...valid, requestedDate: '2026-11-04' }).success).toBe(true)
  })
  it('sin siguiente día disponible no inventa una sugerencia', () => {
    const lastClosed = makeCheckoutSchema('2026-11-03', [day('2026-11-03'), day('2026-11-04', 'closed')])
    const r = lastClosed.safeParse({ ...valid, requestedDate: '2026-11-04' })
    expect(r.success ? '' : r.error.issues[0]?.message).toBe(reasonMessage.closed)
  })
})
