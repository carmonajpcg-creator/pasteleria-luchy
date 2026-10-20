export type OrderStatus = 'pending_contact' | 'confirmed' | 'in_preparation' | 'ready' | 'delivered' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'
export type Fulfillment = 'pickup' | 'delivery'

export interface CreatedOrder {
  folio: string
  public_token: string
  total_cents: number
  status: OrderStatus
}

export interface PublicOrderItem {
  name: string
  quantity: number
  unit_price_cents: number
  line_total_cents: number
}

// Lo único que expone get_order_public: sin nombre, teléfono, correo ni notas.
export interface PublicOrder {
  folio: string
  status: OrderStatus
  payment_status: PaymentStatus
  fulfillment: Fulfillment
  requested_date: string
  total_cents: number
  created_at: string
  items: PublicOrderItem[]
}

export const statusLabel: Record<OrderStatus, string> = {
  pending_contact: 'Pendiente de confirmar por la tienda',
  confirmed: 'Confirmado',
  in_preparation: 'En preparación',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export const paymentLabel: Record<PaymentStatus, string> = {
  unpaid: 'Sin pago registrado',
  partial: 'Anticipo registrado',
  paid: 'Pagado',
  refunded: 'Reembolsado',
}

export const fulfillmentLabel: Record<Fulfillment, string> = {
  pickup: 'Recolección en tienda',
  delivery: 'Entrega a domicilio',
}
