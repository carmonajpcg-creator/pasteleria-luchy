import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Loading, LoadError } from '../../../components/QueryState'
import { btnWhatsApp } from '../../../components/ui'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { formatDate } from '../../../lib/dates'
import { formatMXN } from '../../../lib/money'
import { useStoreSettings } from '../../catalog/hooks'
import { fetchPublicOrder } from '../api'
import { loadExtras } from '../session'
import { fulfillmentLabel, paymentLabel, statusLabel, type PublicOrder } from '../types'
import { buildWhatsAppMessage, buildWhatsAppUrl } from '../whatsapp'

function messageFor(order: PublicOrder) {
  // Nombre, notas y personalización solo existen en esta pestaña; en otro dispositivo el mensaje
  // se arma con los datos públicos y el folio basta para que la tienda lo identifique.
  const extras = loadExtras(order.folio)
  return buildWhatsAppMessage({
    folio: order.folio,
    items: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      lineTotalCents: i.line_total_cents,
      customization: extras?.customizations[i.name],
    })),
    totalCents: order.total_cents,
    fulfillment: order.fulfillment,
    requestedDate: order.requested_date,
    customerName: extras?.customerName,
    notes: extras?.notes || undefined,
  })
}

export function OrderPage() {
  usePageTitle('Seguimiento de pedido')
  const { folio } = useParams()
  const [params] = useSearchParams()
  const token = params.get('t')

  const order = useQuery({
    queryKey: ['order', folio, token],
    queryFn: () => fetchPublicOrder(folio as string, token as string),
    enabled: Boolean(folio && token),
    staleTime: 0,
  })
  const settings = useStoreSettings()

  const heading = <h1 className="mb-4 text-3xl font-bold">Seguimiento de pedido</h1>

  if (!token) {
    return (
      <section>
        {heading}
        <p>
          Para ver un pedido necesitas el enlace completo que recibiste al registrarlo. Por seguridad no se muestran
          pedidos solo con el folio.
        </p>
      </section>
    )
  }
  if (order.isPending) return <section>{heading}<Loading what="tu pedido" /></section>
  if (order.isError) {
    return (
      <section>
        {heading}
        <LoadError what="tu pedido" onRetry={() => void order.refetch()} />
      </section>
    )
  }
  if (!order.data) {
    return (
      <section>
        {heading}
        <p role="alert">No encontramos ese pedido. Revisa que el enlace esté completo.</p>
      </section>
    )
  }

  const o = order.data
  const pending = o.status === 'pending_contact'
  const whatsapp = settings.data?.whatsapp_number
  const message = messageFor(o)

  return (
    <section className="max-w-2xl">
      {heading}
      <p className="mb-1 text-lg">
        Folio: <strong>{o.folio}</strong>
      </p>
      <p className="mb-4">
        Estado: <strong>{statusLabel[o.status]}</strong> · Pago: {paymentLabel[o.payment_status]}
      </p>

      {pending && (
        <div role="note" className="mb-6 rounded-card border-2 border-purple-600 bg-white p-4">
          <h2 className="mb-2 text-xl font-bold">Falta un paso: contacta a la tienda</h2>
          <ol className="mb-4 list-decimal pl-6">
            <li>Presiona el botón para abrir WhatsApp con tu pedido ya escrito.</li>
            <li>Revisa el mensaje y envíalo tú desde WhatsApp.</li>
            <li>
              La tienda lo comparará con el folio <strong>{o.folio}</strong> y te confirmará el pedido, el total final y
              el anticipo si aplica.
            </li>
          </ol>
          <p className="mb-4 font-semibold">
            Abrir WhatsApp no envía el mensaje ni confirma tu pedido: queda confirmado hasta que la tienda te responda.
          </p>
          {whatsapp ? (
            <a
              className={btnWhatsApp}
              href={buildWhatsAppUrl(whatsapp, message)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Continuar a WhatsApp<span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          ) : (
            <p role="alert">La tienda aún no tiene WhatsApp configurado. Guarda tu folio y vuelve más tarde.</p>
          )}
        </div>
      )}

      <h2 className="mb-2 text-xl font-bold">Resumen</h2>
      <ul className="divide-y divide-line rounded-card bg-white px-4 shadow-card">
        {o.items.map((i) => (
          <li key={i.name} className="flex justify-between gap-2 py-2">
            <span>
              {i.quantity} × {i.name}
            </span>
            <span>{formatMXN(i.line_total_cents)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between text-lg font-semibold">
        <span>Total estimado</span>
        <span>{formatMXN(o.total_cents)}</span>
      </p>
      <p className="mt-2">
        {fulfillmentLabel[o.fulfillment]} · Fecha solicitada: {formatDate(o.requested_date)}
      </p>
      <p className="mt-6">
        <Link to="/catalogo" className="font-semibold text-purple-700 underline">
          Seguir explorando el catálogo
        </Link>
      </p>
    </section>
  )
}
