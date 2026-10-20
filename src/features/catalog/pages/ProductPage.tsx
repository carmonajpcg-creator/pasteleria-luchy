import { Link, useParams } from 'react-router-dom'
import { Loading, LoadError } from '../../../components/QueryState'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { formatMXN } from '../../../lib/money'
import { AvailabilityBadge } from '../components/AvailabilityBadge'
import { ProductImage } from '../components/ProductImage'
import { formatLeadTime } from '../filter'
import { useProduct, useProductImages } from '../hooks'

export function ProductPage() {
  const { slug } = useParams()
  const product = useProduct(slug)
  const images = useProductImages()
  usePageTitle(product.data?.name)

  const back = (
    <p className="mb-4">
      <Link to="/catalogo" className="font-semibold text-purple-700 underline">
        ← Volver al catálogo
      </Link>
    </p>
  )

  if (product.isPending) return <Loading what="el producto" />
  if (product.isError) return <LoadError what="el producto" onRetry={() => void product.refetch()} />
  if (!product.data) {
    return (
      <section>
        {back}
        <h1 className="mb-2 text-3xl font-bold">Producto no encontrado</h1>
        <p className="text-muted">Puede que ya no esté disponible. Revisa el catálogo para ver las opciones.</p>
      </section>
    )
  }

  const p = product.data
  const gallery = images.data?.filter((i) => i.product_id === p.id) ?? []
  const lead = formatLeadTime(p.lead_time_hours)

  return (
    <section>
      {back}
      <div className="grid items-start gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-card bg-white shadow-card">
          <ProductImage name={p.name} image={gallery[0]} className="aspect-square" />
        </div>
        <div className="flex flex-col items-start gap-3">
          <h1 className="text-3xl font-bold">{p.name}</h1>
          <AvailabilityBadge product={p} />
          <p className="text-2xl font-semibold">{formatMXN(p.price_cents)}</p>
          <p className="text-muted">Precio provisional, sujeto a confirmación de la tienda.</p>
          {p.description && <p>{p.description}</p>}

          <dl className="grid gap-1">
            <div>
              <dt className="inline font-semibold">Categoría: </dt>
              <dd className="inline">{p.category_name}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Preparación: </dt>
              <dd className="inline">
                {lead ? `anticipación de al menos ${lead} (provisional)` : 'la tienda confirma la fecha al contactarte'}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">Alérgenos: </dt>
              <dd className="inline">
                {p.allergens_verified && p.allergens.length > 0 ? (
                  p.allergens.join(', ')
                ) : (
                  <span className="text-muted">por verificar por la tienda</span>
                )}
              </dd>
            </div>
          </dl>

          {p.fulfillment_type === 'made_to_order' && (
            <p className="text-muted">
              Producto bajo pedido: la fecha más próxima de entrega se confirmará con la tienda.
            </p>
          )}
          <p role="note" className="rounded-xl bg-purple-100 p-3 text-sm">
            Agregar al carrito estará disponible en la siguiente etapa del proyecto. Por ahora puedes explorar el
            catálogo.
          </p>
        </div>
      </div>
    </section>
  )
}
