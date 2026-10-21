import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loading, LoadError } from '../../../components/QueryState'
import { formatDate } from '../../../lib/dates'
import { db, unwrap } from '../lib/client'

interface Capacity {
  capacity: number | null
  days: { day: string; orders: number; closed: boolean; pickup_closed: boolean }[]
}

// Carga de los próximos días: pedidos con productos bajo pedido frente a la capacidad configurada.
export function CapacitySection() {
  const capacity = useQuery({
    queryKey: ['admin', 'capacity'],
    queryFn: () => unwrap<Capacity>(db().rpc('admin_capacity', { p_days: 14 })),
  })

  return (
    <section aria-labelledby="carga-titulo" className="mt-6">
      <h2 id="carga-titulo" className="mb-2 text-xl font-bold">
        Carga de los próximos 14 días
      </h2>
      {capacity.isPending && <Loading what="la carga" />}
      {capacity.isError && <LoadError what="la carga" onRetry={() => void capacity.refetch()} />}
      {capacity.data && (
        <>
          <p className="mb-2 text-sm text-muted">
            Pedidos con productos bajo pedido por fecha solicitada.{' '}
            {capacity.data.capacity === null ? (
              <>
                Sin límite diario configurado.{' '}
                <Link to="/admin/configuracion" className="font-semibold text-purple-700 underline">
                  Definir capacidad
                </Link>
              </>
            ) : (
              `Capacidad diaria: ${capacity.data.capacity}.`
            )}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {capacity.data.days.map((d) => {
              const full = capacity.data.capacity !== null && d.orders >= capacity.data.capacity
              return (
                <li key={d.day} className="flex justify-between gap-2 rounded-card bg-white px-4 py-2 shadow-card">
                  <span>
                    {formatDate(d.day)}
                    {!d.closed && d.pickup_closed && <span className="block text-sm text-muted">Solo entrega a domicilio</span>}
                  </span>
                  <span className={full || d.closed ? 'font-semibold text-danger' : 'font-semibold'}>
                    {d.closed
                      ? 'Cerrado'
                      : capacity.data.capacity === null
                        ? `${d.orders} ${d.orders === 1 ? 'pedido' : 'pedidos'}`
                        : `${d.orders} de ${capacity.data.capacity}${full ? ' · lleno' : ''}`}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
