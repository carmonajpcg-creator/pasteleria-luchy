import type { OrderStatus } from '../../orders/types'

export type OrderAction =
  | { kind: 'confirm'; label: string }
  | { kind: 'advance'; to: 'in_preparation' | 'ready' | 'delivered'; label: string }
  | { kind: 'cancel'; label: string }

// Misma máquina de estados que confirm_order / advance_order / cancel_order en la BD.
// Es solo para decidir qué botones mostrar: el servidor vuelve a validar cada transición.
export function availableActions(status: OrderStatus): OrderAction[] {
  switch (status) {
    case 'pending_contact':
      return [
        { kind: 'confirm', label: 'Confirmar pedido' },
        { kind: 'cancel', label: 'Cancelar pedido' },
      ]
    case 'confirmed':
      return [
        { kind: 'advance', to: 'in_preparation', label: 'Pasar a preparación' },
        { kind: 'cancel', label: 'Cancelar y reponer inventario' },
      ]
    case 'in_preparation':
      return [
        { kind: 'advance', to: 'ready', label: 'Marcar como listo' },
        { kind: 'cancel', label: 'Cancelar y reponer inventario' },
      ]
    case 'ready':
      return [{ kind: 'advance', to: 'delivered', label: 'Marcar como entregado' }]
    default:
      return []
  }
}

/** Saldo pendiente en centavos: total del pedido menos pagos netos de reembolsos. Nunca negativo. */
export function balanceCents(totalCents: number, payments: { amount_cents: number; is_refund: boolean }[]): number {
  const net = payments.reduce((sum, p) => sum + (p.is_refund ? -p.amount_cents : p.amount_cents), 0)
  return Math.max(0, totalCents - net)
}
