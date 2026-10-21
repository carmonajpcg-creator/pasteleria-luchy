// Lógica pura de disponibilidad de fechas (sin red), para poder probarla y usarla en los esquemas.
export type UnavailableReason = 'past' | 'lead' | 'closed' | 'pickup_closed' | 'full'

export interface DayAvailability {
  day: string // YYYY-MM-DD
  available: boolean
  reason: UnavailableReason | null
}

export const reasonMessage: Record<UnavailableReason, string> = {
  past: 'Esa fecha ya pasó.',
  lead: 'Esa fecha no alcanza la anticipación que requiere tu pedido.',
  closed: 'La tienda no recibe pedidos para esa fecha.',
  pickup_closed: 'Ese día no hay recolección en tienda; puedes elegir entrega a domicilio.',
  full: 'Ya no hay cupo para esa fecha.',
}

/** Primer día disponible, o null si ninguno lo está. */
export const firstAvailableDay = (days: DayAvailability[]) => days.find((d) => d.available)?.day ?? null

/** Días no disponibles → motivo, para validar la fecha elegida. */
export const unavailableMap = (days: DayAvailability[]): Record<string, UnavailableReason> =>
  Object.fromEntries(days.filter((d) => !d.available && d.reason).map((d) => [d.day, d.reason as UnavailableReason]))

/** Siguiente día disponible a partir de `after` (exclusivo), o null. */
export const nextAvailableAfter = (days: DayAvailability[], after: string) =>
  days.find((d) => d.available && d.day > after)?.day ?? null
