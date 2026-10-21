import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loading, LoadError } from '../../../../components/QueryState'
import { btnPrimary } from '../../../../components/ui'
import { usePageTitle } from '../../../../hooks/usePageTitle'
import { formatDate } from '../../../../lib/dates'
import { formatMXN } from '../../../../lib/money'
import { fulfillmentLabel, paymentLabel, statusLabel } from '../../../orders/types'
import { db, unwrap } from '../../lib/client'
import { useExec } from '../../lib/useExec'
import { advanceOrder, cancelOrder, confirmOrder, getOrder, listOrderMovements } from '../api'
import { PaymentForm } from '../components/PaymentForm'
import { availableActions, balanceCents } from '../transitions'

const methodLabel = { cash: 'Efectivo', transfer: 'Transferencia', other: 'Otro' } as const
const dateTime = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

export function OrderDetailPage() {
  const { id } = useParams()
  const order = useQuery({ queryKey: ['admin', 'order', id], queryFn: () => getOrder(id as string), enabled: Boolean(id) })
  const movements = useQuery({
    queryKey: ['admin', 'order-movements', id],
    queryFn: () => listOrderMovements(id as string),
    enabled: Boolean(id),
  })
  // H3 (revisión Fase 8): un pendiente caducado ya no reserva su lugar; si la fecha se llenó mientras
  // tanto, confirmarlo rebasa la capacidad. Se avisa y se pide confirmación explícita.
  // Se compara con la hora en que se cargó el pedido (se recarga tras cada acción).
  const expiredPending =
    order.data?.status === 'pending_contact' && new Date(order.data.expires_at).getTime() < order.dataUpdatedAt
  const dayCapacity = useQuery({
    queryKey: ['admin', 'day-capacity', order.data?.requested_date],
    queryFn: () =>
      unwrap<{ capacity: number | null; orders: number }>(
        db().rpc('admin_day_capacity', { p_day: order.data?.requested_date }),
      ),
    enabled: Boolean(expiredPending),
  })
  const overCapacity =
    expiredPending &&
    dayCapacity.data?.capacity != null &&
    dayCapacity.data.orders >= dayCapacity.data.capacity
  const { exec, busy, error } = useExec()
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  usePageTitle(order.data ? `Pedido ${order.data.folio}` : 'Pedido')

  const back = (
    <p className="mb-4">
      <Link to="/admin/pedidos" className="font-semibold text-purple-700 underline">
        ← Volver a pedidos
      </Link>
    </p>
  )

  if (order.isPending) return <Loading what="el pedido" />
  if (order.isError) return <LoadError what="el pedido" onRetry={() => void order.refetch()} />
  if (!order.data) {
    return (
      <section>
        {back}
        <h1 className="text-3xl font-bold">Pedido no encontrado</h1>
      </section>
    )
  }

  const o = order.data
  const actions = availableActions(o.status)
  const balance = balanceCents(o.total_cents, o.payments)
  const reasonOk = reason.trim().length >= 3
  const restocks = o.status === 'confirmed' || o.status === 'in_preparation'

  return (
    <section>
      {back}
      <h1 className="mb-1 text-3xl font-bold">Pedido {o.folio}</h1>
      <p className="mb-4">
        Estado: <strong>{statusLabel[o.status]}</strong> · Pago: <strong>{paymentLabel[o.payment_status]}</strong>
      </p>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-danger bg-white p-3 text-danger">
          {error}
        </p>
      )}

      {actions.length > 0 && (
        <div className="mb-6 rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-2 text-xl font-bold">Acciones</h2>
          {overCapacity && (
            <p role="alert" className="mb-3 rounded-xl border border-danger p-3 text-danger">
              Este pedido caducó y la fecha {formatDate(o.requested_date)} ya tiene {dayCapacity.data?.orders} de{' '}
              {dayCapacity.data?.capacity} pedidos. Si lo confirmas, ese día quedará por encima de la capacidad.
            </p>
          )}
          {o.status === 'pending_contact' && (
            <p className="mb-3 text-sm text-muted">
              Antes de confirmar, coteja la conversación de WhatsApp con el folio <strong>{o.folio}</strong>. Al confirmar
              se descuenta el inventario de los productos de existencia; hacerlo otra vez no descuenta de nuevo.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {actions.map((a) =>
              a.kind === 'cancel' ? (
                <button
                  key="cancel"
                  type="button"
                  disabled={busy}
                  onClick={() => setCancelling(true)}
                  className="inline-flex min-h-12 items-center rounded-full border-2 border-danger px-6 font-semibold text-danger disabled:opacity-60"
                >
                  {a.label}
                </button>
              ) : (
                <button
                  key={a.kind + ('to' in a ? a.to : '')}
                  type="button"
                  disabled={busy}
                  className={`${btnPrimary} disabled:opacity-60`}
                  onClick={() => {
                    if (
                      a.kind === 'confirm' &&
                      overCapacity &&
                      !window.confirm('La fecha ya está llena. ¿Confirmar de todos modos y rebasar la capacidad?')
                    ) {
                      return
                    }
                    void exec(() => (a.kind === 'confirm' ? confirmOrder(o.id) : advanceOrder(o.id, a.to)))
                  }}
                >
                  {a.label}
                </button>
              ),
            )}
          </div>

          {cancelling && (
            <div className="mt-4 rounded-xl border border-danger p-3">
              <label htmlFor="motivo" className="mb-1 block font-semibold">
                Motivo de la cancelación
              </label>
              <textarea
                id="motivo"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mb-2 w-full rounded-xl border border-line bg-white px-4 py-2"
              />
              <p className="mb-3 text-sm text-muted">
                {restocks
                  ? 'Se repondrá el inventario descontado y quedará registrado el movimiento.'
                  : 'El pedido aún no descontó inventario.'}{' '}
                Esta acción no se puede deshacer.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy || !reasonOk}
                  className="inline-flex min-h-12 items-center rounded-full bg-danger px-6 font-semibold text-white disabled:opacity-60"
                  onClick={() =>
                    void exec(() => cancelOrder(o.id, reason.trim())).then((ok) => {
                      if (ok) {
                        setCancelling(false)
                        setReason('')
                      }
                    })
                  }
                >
                  Confirmar cancelación
                </button>
                <button
                  type="button"
                  className="min-h-12 font-semibold underline"
                  onClick={() => {
                    setCancelling(false)
                    setReason('')
                  }}
                >
                  No cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid items-start gap-6 md:grid-cols-2">
        <div className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-2 text-xl font-bold">Cliente</h2>
          <dl className="grid gap-1">
            <div>
              <dt className="inline font-semibold">Nombre: </dt>
              <dd className="inline">{o.customer_name}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Teléfono: </dt>
              <dd className="inline">{o.customer_phone}</dd>
            </div>
            {o.customer_email && (
              <div>
                <dt className="inline font-semibold">Correo: </dt>
                <dd className="inline">{o.customer_email}</dd>
              </div>
            )}
            <div>
              <dt className="inline font-semibold">Modalidad: </dt>
              <dd className="inline">{fulfillmentLabel[o.fulfillment]}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Fecha solicitada: </dt>
              <dd className="inline">{formatDate(o.requested_date)}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Registrado: </dt>
              <dd className="inline">{dateTime(o.created_at)}</dd>
            </div>
            {o.status === 'pending_contact' && (
              <div>
                <dt className="inline font-semibold">Caduca: </dt>
                <dd className="inline">{dateTime(o.expires_at)}</dd>
              </div>
            )}
            {o.notes && (
              <div>
                <dt className="inline font-semibold">Notas: </dt>
                <dd className="inline">{o.notes}</dd>
              </div>
            )}
            {o.cancel_reason && (
              <div>
                <dt className="inline font-semibold">Motivo de cancelación: </dt>
                <dd className="inline">{o.cancel_reason}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-2 text-xl font-bold">Productos</h2>
          <ul className="divide-y divide-line">
            {o.order_items.map((i) => (
              <li key={i.id} className="py-2">
                <div className="flex justify-between gap-2">
                  <span>
                    {i.quantity} × {i.name} <span className="text-sm text-muted">({i.sku})</span>
                  </span>
                  <span>{formatMXN(i.line_total_cents)}</span>
                </div>
                {i.customization && <p className="text-sm text-muted">Personalización: {i.customization}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatMXN(o.total_cents)}</span>
          </p>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
        <div className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-2 text-xl font-bold">Pagos</h2>
          {o.payments.length === 0 ? (
            <p className="text-muted">Sin pagos registrados.</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...o.payments]
                .sort((a, b) => a.paid_at.localeCompare(b.paid_at))
                .map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 py-2">
                    <span>
                      {p.is_refund ? 'Reembolso' : 'Pago'} · {methodLabel[p.method]} · {dateTime(p.paid_at)}
                      {p.note && <span className="block text-sm text-muted">{p.note}</span>}
                    </span>
                    <span>
                      {p.is_refund ? '−' : ''}
                      {formatMXN(p.amount_cents)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-2 flex justify-between text-lg font-semibold">
            <span>Saldo pendiente</span>
            <span>{formatMXN(balance)}</span>
          </p>
        </div>

        <div className="rounded-card bg-white p-4 shadow-card">
          <PaymentForm orderId={o.id} />
        </div>
      </div>

      <div className="mt-6 rounded-card bg-white p-4 shadow-card">
        <h2 className="mb-2 text-xl font-bold">Movimientos de inventario de este pedido</h2>
        {movements.isPending ? (
          <Loading what="los movimientos" />
        ) : movements.data && movements.data.length > 0 ? (
          <ul className="divide-y divide-line">
            {movements.data.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 py-2">
                <span>
                  {m.products?.name ?? 'Producto'} · {m.reason === 'order_confirmed' ? 'Descuento por confirmación' : 'Reposición por cancelación'}
                  <span className="block text-sm text-muted">{dateTime(m.created_at)}</span>
                </span>
                <span>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Este pedido no ha movido inventario.</p>
        )}
      </div>
    </section>
  )
}
