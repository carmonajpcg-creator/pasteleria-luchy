import { supabase } from '../../lib/supabase'
import type { CreatedOrder, Fulfillment, PublicOrder } from './types'

export interface CreateOrderInput {
  idempotencyKey: string
  name: string
  phone: string
  email: string
  fulfillment: Fulfillment
  requestedDate: string
  notes: string
  privacyAccepted: boolean
  // Solo producto, cantidad y personalización: el servidor decide precios y totales.
  items: { productId: string; quantity: number; customization?: string }[]
}

/** Errores de create_order pensados para mostrarse tal cual (mensajes en español de la BD). */
export class OrderError extends Error {}

const USER_FACING_CODES = new Set(['22023', '54000'])

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  return supabase
}

export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const { data, error } = await client().rpc('create_order', {
    p_idempotency_key: input.idempotencyKey,
    p_customer_name: input.name,
    p_customer_phone: input.phone,
    p_customer_email: input.email || null,
    p_fulfillment: input.fulfillment,
    p_requested_date: input.requestedDate,
    p_notes: input.notes || null,
    p_privacy_accepted: input.privacyAccepted,
    p_items: input.items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      customization: i.customization ?? null,
    })),
  })
  if (error) {
    if (USER_FACING_CODES.has(error.code)) throw new OrderError(error.message)
    throw error
  }
  const order = (data as CreatedOrder[] | null)?.[0]
  if (!order) throw new Error('create_order no devolvió el pedido')
  return order
}

export async function fetchPublicOrder(folio: string, token: string): Promise<PublicOrder | null> {
  const { data, error } = await client().rpc('get_order_public', { p_folio: folio, p_token: token })
  if (error) throw error
  return (data as PublicOrder | null) ?? null
}
