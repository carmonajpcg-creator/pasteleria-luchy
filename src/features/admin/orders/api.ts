import type { Fulfillment, OrderStatus, PaymentStatus } from '../../orders/types'
import { db, unwrap } from '../lib/client'

export interface OrderSummary {
  id: string
  folio: string
  status: OrderStatus
  payment_status: PaymentStatus
  customer_name: string
  total_cents: number
  requested_date: string
  fulfillment: Fulfillment
  created_at: string
}

export interface OrderItemRow {
  id: string
  sku: string
  name: string
  unit_price_cents: number
  quantity: number
  customization: string | null
  line_total_cents: number
}

export interface PaymentRow {
  id: string
  amount_cents: number
  is_refund: boolean
  method: 'cash' | 'transfer' | 'other'
  note: string | null
  paid_at: string
}

export interface MovementRow {
  id: string
  delta: number
  reason: string
  created_at: string
  note: string | null
  products: { name: string; sku: string } | null
}

export interface OrderDetailData extends OrderSummary {
  customer_phone: string
  customer_email: string | null
  notes: string | null
  stock_deducted: boolean
  expires_at: string
  confirmed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  order_items: OrderItemRow[]
  payments: PaymentRow[]
}

// Columnas explícitas: no se trae idempotency_key ni public_token (el panel no los necesita).
const SUMMARY = 'id, folio, status, payment_status, customer_name, total_cents, requested_date, fulfillment, created_at'
const DETAIL = `${SUMMARY}, customer_phone, customer_email, notes, stock_deducted, expires_at, confirmed_at, cancelled_at, cancel_reason,
  order_items(id, sku, name, unit_price_cents, quantity, customization, line_total_cents),
  payments(id, amount_cents, is_refund, method, note, paid_at)`

export interface OrderFilters {
  status: OrderStatus | ''
  query: string
}

export const ORDERS_PAGE_LIMIT = 100

export async function listOrders({ status, query }: OrderFilters): Promise<OrderSummary[]> {
  let q = db().from('orders').select(SUMMARY).order('created_at', { ascending: false }).limit(ORDERS_PAGE_LIMIT)
  if (status) q = q.eq('status', status)
  // Solo caracteres válidos de un folio: evita comodines y símbolos en el patrón ilike.
  const folio = query.trim().replace(/[^A-Za-z0-9-]/g, '')
  if (folio) q = q.ilike('folio', `%${folio}%`)
  return unwrap<OrderSummary[]>(q)
}

export async function getOrder(id: string): Promise<OrderDetailData | null> {
  const { data, error } = await db().from('orders').select(DETAIL).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as OrderDetailData | null
}

export async function listOrderMovements(orderId: string): Promise<MovementRow[]> {
  return unwrap<MovementRow[]>(
    db()
      .from('inventory_movements')
      .select('id, delta, reason, created_at, note, products(name, sku)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
  )
}

export const confirmOrder = (orderId: string) => unwrap(db().rpc('confirm_order', { p_order_id: orderId }))

export const advanceOrder = (orderId: string, to: OrderStatus) =>
  unwrap(db().rpc('advance_order', { p_order_id: orderId, p_to: to }))

export const cancelOrder = (orderId: string, reason: string) =>
  unwrap(db().rpc('cancel_order', { p_order_id: orderId, p_reason: reason }))

export interface PaymentInput {
  orderId: string
  amountCents: number
  isRefund: boolean
  method: PaymentRow['method']
  note: string
}

export async function addPayment(input: PaymentInput): Promise<void> {
  const { error } = await db()
    .from('payments')
    .insert({
      order_id: input.orderId,
      amount_cents: input.amountCents,
      is_refund: input.isRefund,
      method: input.method,
      note: input.note.trim() || null,
    })
  if (error) throw error
}
