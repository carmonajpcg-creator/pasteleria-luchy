import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { inputClass } from '../../../../components/Field'
import { Loading, LoadError } from '../../../../components/QueryState'
import { usePageTitle } from '../../../../hooks/usePageTitle'
import { formatDate } from '../../../../lib/dates'
import { formatMXN } from '../../../../lib/money'
import { fulfillmentLabel, paymentLabel, statusLabel, type OrderStatus } from '../../../orders/types'
import { listOrders } from '../api'

const STATUSES = Object.keys(statusLabel) as OrderStatus[]

export function OrdersPage() {
  usePageTitle('Pedidos')
  const [params, setParams] = useSearchParams()
  const status = (STATUSES.find((s) => s === params.get('estado')) ?? '') as OrderStatus | ''
  const query = params.get('q') ?? ''

  const orders = useQuery({
    queryKey: ['admin', 'orders', status, query],
    queryFn: () => listOrders({ status, query }),
  })

  const update = (next: { estado?: string; q?: string }) => {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value)
      else merged.delete(key)
    }
    setParams(merged, { replace: true })
  }

  return (
    <section>
      <h1 className="mb-4 text-3xl font-bold">Pedidos</h1>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="font-semibold">
            Buscar por folio
          </label>
          <input
            id="q"
            type="search"
            value={query}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Ej. L-ABC1234"
            className={`${inputClass} border-line`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="estado" className="font-semibold">
            Estado
          </label>
          <select
            id="estado"
            value={status}
            onChange={(e) => update({ estado: e.target.value })}
            className={`${inputClass} border-line`}
          >
            <option value="">Todos</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {orders.isPending && <Loading what="los pedidos" />}
      {orders.isError && <LoadError what="los pedidos" onRetry={() => void orders.refetch()} />}
      {orders.data && (
        <>
          <p role="status" className="mb-3 text-muted">
            {orders.data.length} {orders.data.length === 1 ? 'pedido' : 'pedidos'}
          </p>
          {orders.data.length === 0 ? (
            <p className="rounded-card bg-white p-6 shadow-card">No hay pedidos con esos filtros.</p>
          ) : (
            <ul className="grid gap-3">
              {orders.data.map((o) => (
                <li key={o.id} className="rounded-card bg-white p-4 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        <Link to={`/admin/pedidos/${o.id}`} className="text-purple-700 underline">
                          {o.folio}
                        </Link>{' '}
                        · {o.customer_name}
                      </p>
                      <p className="text-sm text-muted">
                        {fulfillmentLabel[o.fulfillment]} · {formatDate(o.requested_date)}
                      </p>
                      <p className="text-sm">
                        {statusLabel[o.status]} · {paymentLabel[o.payment_status]}
                      </p>
                    </div>
                    <p className="font-semibold">{formatMXN(o.total_cents)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
