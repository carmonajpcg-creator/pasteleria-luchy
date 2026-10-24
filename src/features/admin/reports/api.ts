import { db, unwrap } from '../lib/client'

export interface SalesReport {
  from: string
  to: string
  orders: number
  sales_cents: number
  cancelled: number
  paid_cents: number
  by_day: { day: string; orders: number; sales_cents: number }[]
  by_product: { sku: string; name: string; quantity: number; total_cents: number }[]
}

export const getSalesReport = (from: string, to: string) =>
  unwrap<SalesReport>(db().rpc('admin_sales_report', { p_from: from, p_to: to }))
