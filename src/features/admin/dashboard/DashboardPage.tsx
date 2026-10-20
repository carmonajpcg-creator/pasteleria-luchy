import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loading, LoadError } from '../../../components/QueryState'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { formatMXN } from '../../../lib/money'
import { statusLabel, type OrderStatus } from '../../orders/types'
import { db, unwrap } from '../lib/client'

interface Dashboard {
  orders_by_status: Partial<Record<OrderStatus, number>>
  confirmed_sales_cents: number
  paid_cents: number
  low_stock: { id: string; sku: string; name: string; stock_quantity: number; low_stock_threshold: number }[]
}

const ORDER: OrderStatus[] = ['pending_contact', 'confirmed', 'in_preparation', 'ready', 'delivered', 'cancelled']

export function DashboardPage() {
  usePageTitle('Panel administrativo')
  const dashboard = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => unwrap<Dashboard>(db().rpc('admin_dashboard')),
  })

  return (
    <section>
      <h1 className="mb-4 text-3xl font-bold">Panel administrativo</h1>
      {dashboard.isPending && <Loading what="el panel" />}
      {dashboard.isError && <LoadError what="el panel" onRetry={() => void dashboard.refetch()} />}
      {dashboard.data && (
        <>
          <h2 className="mb-2 text-xl font-bold">Pedidos por estado</h2>
          <ul className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {ORDER.map((s) => (
              <li key={s}>
                <Link
                  to={`/admin/pedidos?estado=${s}`}
                  className="block rounded-card bg-white p-4 text-ink no-underline shadow-card"
                >
                  <span className="block text-3xl font-bold">{dashboard.data.orders_by_status[s] ?? 0}</span>
                  <span className="text-sm text-muted">{statusLabel[s]}</span>
                </Link>
              </li>
            ))}
          </ul>

          <h2 className="mb-2 text-xl font-bold">Dinero</h2>
          <dl className="mb-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-card bg-white p-4 shadow-card">
              <dt className="text-sm text-muted">Ventas confirmadas</dt>
              <dd className="text-2xl font-bold">{formatMXN(dashboard.data.confirmed_sales_cents)}</dd>
              <dd className="text-sm text-muted">Pedidos confirmados o posteriores, sin cancelados.</dd>
            </div>
            <div className="rounded-card bg-white p-4 shadow-card">
              <dt className="text-sm text-muted">Pagos registrados (neto de reembolsos)</dt>
              <dd className="text-2xl font-bold">{formatMXN(dashboard.data.paid_cents)}</dd>
              <dd className="text-sm text-muted">Anotados manualmente; no hay cobro en línea.</dd>
            </div>
          </dl>

          <h2 className="mb-2 text-xl font-bold">Productos con stock bajo</h2>
          {dashboard.data.low_stock.length === 0 ? (
            <p className="rounded-card bg-white p-4 shadow-card">Ningún producto con stock bajo.</p>
          ) : (
            <ul className="divide-y divide-line rounded-card bg-white px-4 shadow-card">
              {dashboard.data.low_stock.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 py-3">
                  <span>
                    {p.name} <span className="text-sm text-muted">({p.sku})</span>
                  </span>
                  <span className="font-semibold">
                    {p.stock_quantity} en existencia · aviso en {p.low_stock_threshold}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3">
            <Link to="/admin/inventario" className="font-semibold text-purple-700 underline">
              Ir a inventario
            </Link>
          </p>
        </>
      )}
    </section>
  )
}
