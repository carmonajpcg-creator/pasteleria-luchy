import { Link } from 'react-router-dom'
import { Loading, LoadError } from '../../../components/QueryState'
import { btnPrimary } from '../../../components/ui'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { formatMXN } from '../../../lib/money'
import { AvailabilityBadge } from '../../catalog/components/AvailabilityBadge'
import { QuantitySelector } from '../components/QuantitySelector'
import { useCart } from '../store'
import { useCartLines } from '../useCartLines'

export function CartPage() {
  usePageTitle('Carrito')
  const { items, lines, missing, unavailable, totalCents, products } = useCartLines()
  const { setQuantity, remove } = useCart()

  return (
    <section>
      <h1 className="mb-4 text-3xl font-bold">Carrito</h1>

      {items.length === 0 ? (
        <div className="rounded-card bg-white p-6 shadow-card">
          <p className="mb-4">Tu carrito está vacío.</p>
          <Link to="/catalogo" className={btnPrimary}>
            Ver catálogo
          </Link>
        </div>
      ) : products.isPending ? (
        <Loading what="tu carrito" />
      ) : products.isError ? (
        <LoadError what="tu carrito" onRetry={() => void products.refetch()} />
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-[1fr_320px]">
          <div className="rounded-card bg-white p-4 shadow-card">
            <h2 className="sr-only">Productos en tu carrito</h2>

            {missing.length > 0 && (
              <div role="alert" className="mb-4 rounded-xl border border-danger p-3 text-danger">
                <p>Algunos productos de tu carrito ya no están disponibles en el catálogo.</p>
                <button
                  type="button"
                  className="mt-1 min-h-12 font-semibold underline"
                  onClick={() => missing.forEach((m) => remove(m.productId))}
                >
                  Quitarlos del carrito
                </button>
              </div>
            )}

            <ul className="divide-y divide-line">
              {lines.map(({ item, product, lineTotalCents }) => (
                <li key={product.id} className="grid gap-2 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        <Link to={`/producto/${product.slug}`} className="text-ink">
                          {product.name}
                        </Link>
                      </p>
                      <p className="text-sm text-muted">{formatMXN(product.price_cents)} c/u (provisional)</p>
                      <AvailabilityBadge product={product} />
                      {item.customization && (
                        <p className="mt-1 text-sm">Personalización: {item.customization}</p>
                      )}
                    </div>
                    <p className="font-semibold">{formatMXN(lineTotalCents)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <QuantitySelector
                      name={product.name}
                      value={item.quantity}
                      onChange={(q) => setQuantity(product.id, q)}
                    />
                    <button
                      type="button"
                      className="min-h-12 px-2 font-semibold text-danger underline"
                      aria-label={`Eliminar ${product.name} del carrito`}
                      onClick={() => remove(product.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <aside aria-labelledby="resumen" className="rounded-card bg-white p-4 shadow-card">
            <h2 id="resumen" className="mb-2 text-xl font-bold">
              Resumen
            </h2>
            <p className="flex justify-between text-lg font-semibold">
              <span>Total estimado</span>
              <span>{formatMXN(totalCents)}</span>
            </p>
            <p className="mb-4 text-sm text-muted">
              El total final lo confirma la tienda; los precios y la disponibilidad se validan al registrar el
              pedido.
            </p>
            {unavailable.length > 0 && (
              <p role="alert" className="mb-4 text-danger">
                Hay productos agotados en tu carrito. Quítalos para continuar.
              </p>
            )}
            {lines.length > 0 && unavailable.length === 0 && missing.length === 0 ? (
              <Link to="/checkout" className={`${btnPrimary} w-full`}>
                Continuar con el pedido
              </Link>
            ) : null}
          </aside>
        </div>
      )}
    </section>
  )
}
