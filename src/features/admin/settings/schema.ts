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
  confirmWhatsapp: z.boolean(),
})
export type SettingsValues = z.infer<typeof settingsSchema>

export interface StoreSettingsRow {
  store_name: string
  whatsapp_number: string | null
  contact_email: string | null
  contact_phone: string | null
  schedule_text: string | null
  coverage_text: string | null
  timezone: string
  order_expiry_hours: number
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
})
