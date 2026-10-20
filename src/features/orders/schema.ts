import { z } from 'zod'
import { parseIsoDate, toIsoDate } from '../../lib/dates'

export const MAX_DAYS_AHEAD = 90

/**
 * Fecha mínima con la misma regla que create_order: la fecha, en la zona horaria de la tienda,
 * del instante «ahora + anticipación». La validación definitiva sigue siendo la del servidor.
 */
export function minRequestedDate(maxLeadHours: number, timeZone: string, now = new Date()): string {
  const target = new Date(now.getTime() + maxLeadHours * 3_600_000)
  try {
    // en-CA formatea como YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      target,
    )
  } catch {
    return toIsoDate(target) // zona inválida: hora local; el servidor decide
  }
}

export function maxRequestedDate(minDate: string): string {
  const d = parseIsoDate(minDate)
  d.setDate(d.getDate() + MAX_DAYS_AHEAD)
  return toIsoDate(d)
}

// Mismos límites que las restricciones de la tabla orders (supabase/migrations).
export const makeCheckoutSchema = (minDate: string) =>
  z.object({
    name: z.string().trim().min(2, 'Escribe tu nombre').max(100, 'Máximo 100 caracteres'),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+() -]{8,20}$/, 'Ingresa un teléfono válido: solo números, +, espacios, guiones o paréntesis')
      .refine((v) => v.replace(/\D/g, '').length >= 8, 'Ingresa un teléfono con al menos 8 dígitos'),
    email: z
      .string()
      .trim()
      .max(254, 'Correo demasiado largo')
      .refine((v) => v === '' || /^[^@\s]+@[^@\s]+$/.test(v), 'Ingresa un correo válido o déjalo vacío'),
    fulfillment: z.enum(['pickup', 'delivery']),
    requestedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige una fecha')
      .refine((v) => v >= minDate, 'Elige una fecha a partir del día indicado')
      .refine((v) => v <= maxRequestedDate(minDate), 'La fecha es demasiado lejana'),
    notes: z.string().trim().max(1000, 'Máximo 1000 caracteres'),
    privacy: z.boolean().refine((v) => v, 'Debes aceptar el aviso de privacidad y las condiciones para continuar'),
  })

export type CheckoutValues = z.infer<ReturnType<typeof makeCheckoutSchema>>
