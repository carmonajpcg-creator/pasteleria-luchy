import { db, unwrap } from '../lib/client'

export interface StockRow {
  id: string
  sku: string
  name: string
  stock_quantity: number
  low_stock_threshold: number
  active: boolean
}

export interface MovementRecord {
  id: string
  delta: number
  reason: string
  note: string | null
  created_at: string
  order_id: string | null
}

export type ManualReason = 'production' | 'purchase' | 'adjustment' | 'waste'

export const reasonLabel: Record<string, string> = {
  initial: 'Existencia inicial',
  production: 'Producción',
  purchase: 'Compra',
  adjustment: 'Ajuste',
  waste: 'Merma',
  order_confirmed: 'Pedido confirmado',
  order_cancelled: 'Pedido cancelado',
}

export const listStock = () =>
  unwrap<StockRow[]>(
    db()
      .from('products')
      .select('id, sku, name, stock_quantity, low_stock_threshold, active')
      .eq('fulfillment_type', 'stock')
      .order('stock_quantity')
      .order('name'),
  )

export const countMadeToOrder = async (): Promise<number> => {
  const { count, error } = await db()
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('fulfillment_type', 'made_to_order')
  if (error) throw error
  return count ?? 0
}

export const listMovements = (productId: string) =>
  unwrap<MovementRecord[]>(
    db()
      .from('inventory_movements')
      .select('id, delta, reason, note, created_at, order_id')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50),
  )

export const adjustStock = (productId: string, delta: number, reason: ManualReason, note: string) =>
  unwrap<number>(db().rpc('adjust_stock', { p_product_id: productId, p_delta: delta, p_reason: reason, p_note: note.trim() || null }))

/**
 * Signo del movimiento: producción y compra suman, merma resta; «ajuste» usa la dirección elegida.
 * Devuelve null si la cantidad no es un entero positivo.
 */
export function signedDelta(reason: ManualReason, direction: 'add' | 'subtract', amount: string): number | null {
  if (!/^\d{1,6}$/.test(amount.trim())) return null
  const n = Number(amount)
  if (n <= 0) return null
  if (reason === 'production' || reason === 'purchase') return n
  if (reason === 'waste') return -n
  return direction === 'add' ? n : -n
}
