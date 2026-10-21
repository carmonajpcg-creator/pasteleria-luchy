import { formatDate } from '../../lib/dates'
import { formatMXN } from '../../lib/money'
import { fulfillmentLabel, type Fulfillment } from './types'

export interface WhatsAppOrder {
  folio: string
  items: { name: string; quantity: number; lineTotalCents: number; customization?: string }[]
  totalCents: number
  fulfillment: Fulfillment
  requestedDate: string // YYYY-MM-DD
  customerName?: string
  notes?: string
  /** Aviso de la tienda (p. ej. «sitio en preparación»): va al inicio para que la tienda lo vea primero. */
  storeNotice?: string | null
}

// Mensaje legible para la tienda. Abrir WhatsApp no envía nada ni confirma el pedido: el folio
// permite a la tienda cotejar la conversación con el registro (CLAUDE.md §1, pasos 4–6).
export function buildWhatsAppMessage(order: WhatsAppOrder): string {
  const lines = [
    ...(order.storeNotice ? [`(Aviso del sitio: ${order.storeNotice})`, ''] : []),
    `Hola, quiero confirmar mi pedido ${order.folio}.`,
    '',
    'Productos:',
    ...order.items.map(
      (i) =>
        `- ${i.quantity} x ${i.name} — ${formatMXN(i.lineTotalCents)}` +
        (i.customization ? ` (Personalización: ${i.customization})` : ''),
    ),
    '',
    `Total estimado: ${formatMXN(order.totalCents)}`,
    `Modalidad: ${fulfillmentLabel[order.fulfillment]}`,
    `Fecha solicitada: ${formatDate(order.requestedDate)}`,
  ]
  if (order.customerName) lines.push(`Nombre: ${order.customerName}`)
  if (order.notes) lines.push(`Notas: ${order.notes}`)
  lines.push('', 'Entiendo que el pedido queda confirmado cuando la tienda me responda.')
  return lines.join('\n')
}

/** `number` en formato internacional, solo dígitos (store_settings.whatsapp_number). */
export function buildWhatsAppUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
