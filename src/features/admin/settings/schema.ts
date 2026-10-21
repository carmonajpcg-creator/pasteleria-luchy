import { z } from 'zod'

function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

const optionalText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`)

export const settingsSchema = z.object({
  storeName: z.string().trim().min(1, 'Escribe el nombre de la tienda').max(100, 'Máximo 100 caracteres'),
  whatsapp: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-9]{8,15}$/.test(v), 'Solo dígitos, con código de país y sin «+» (ej. 528787030104)'),
  contactEmail: optionalText(200).refine((v) => v === '' || /^[^@\s]+@[^@\s]+$/.test(v), 'Ingresa un correo válido'),
  contactPhone: optionalText(40),
  scheduleText: optionalText(500),
  coverageText: optionalText(500),
  timezone: z.string().trim().refine(isValidTimeZone, 'Zona horaria no válida (ej. America/Matamoros)'),
  orderExpiryHours: z
    .string()
    .regex(/^\d{1,3}$/, 'Escribe horas enteras (1 a 720)')
    .refine((v) => Number(v) >= 1 && Number(v) <= 720, 'Escribe horas enteras (1 a 720)'),
  closedWeekdays: z.array(z.number().int().min(0).max(6)).max(6, 'No puedes cerrar los 7 días de la semana'),
  closedDates: z.string().max(4000, 'Demasiadas fechas').superRefine((v, ctx) => {
    const { invalid } = parseClosedDates(v)
    if (invalid.length > 0) {
      ctx.addIssue({ code: 'custom', message: `Fecha no válida: ${invalid[0]}. Usa el formato AAAA-MM-DD, una por línea o separadas por comas.` })
    }
  }),
  dailyCapacity: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d{1,4}$/.test(v) && Number(v) >= 1 && Number(v) <= 1000), 'Escribe un número de 1 a 1000, o déjalo vacío para no limitar'),
  minLeadHours: z
    .string()
    .trim()
    .refine((v) => /^\d{1,3}$/.test(v) && Number(v) <= 720, 'Escribe horas enteras (0 a 720)'),
  confirmWhatsapp: z.boolean(),
})
export type SettingsValues = z.infer<typeof settingsSchema>

/** «2026-12-24, 2026-12-25» → fechas ISO válidas, únicas y ordenadas, más las entradas inválidas. */
export function parseClosedDates(text: string): { dates: string[]; invalid: string[] } {
  const parts = text.split(/[\s,;]+/).filter(Boolean)
  const dates: string[] = []
  const invalid: string[] = []
  for (const p of parts) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p)
    const real = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
    const ok = m && real && real.getFullYear() === Number(m[1]) && real.getMonth() === Number(m[2]) - 1 && real.getDate() === Number(m[3])
    if (ok) dates.push(p)
    else invalid.push(p)
  }
  return { dates: [...new Set(dates)].sort(), invalid }
}

export interface StoreSettingsRow {
  store_name: string
  whatsapp_number: string | null
  contact_email: string | null
  contact_phone: string | null
  schedule_text: string | null
  coverage_text: string | null
  timezone: string
  order_expiry_hours: number
  closed_weekdays: number[]
  closed_dates: string[]
  daily_capacity: number | null
  min_lead_hours: number
}

export const toSettingsPatch = (v: SettingsValues): StoreSettingsRow => ({
  store_name: v.storeName.trim(),
  whatsapp_number: v.whatsapp.trim() || null,
  contact_email: v.contactEmail.trim() || null,
  contact_phone: v.contactPhone.trim() || null,
  schedule_text: v.scheduleText.trim() || null,
  coverage_text: v.coverageText.trim() || null,
  timezone: v.timezone.trim(),
  order_expiry_hours: Number(v.orderExpiryHours),
  closed_weekdays: [...new Set(v.closedWeekdays)].sort(),
  closed_dates: parseClosedDates(v.closedDates).dates,
  daily_capacity: v.dailyCapacity.trim() === '' ? null : Number(v.dailyCapacity),
  min_lead_hours: Number(v.minLeadHours),
})
