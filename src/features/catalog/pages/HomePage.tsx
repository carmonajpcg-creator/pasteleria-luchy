import { Link } from 'react-router-dom'
import { Loading, LoadError } from '../../../components/QueryState'
import { btnOutline, btnPrimary, chip } from '../../../components/ui'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { ProductCard, ProductGrid } from '../components/ProductCard'
import { useCategories, useProductImages, useProducts } from '../hooks'

export function HomePage() {
  usePageTitle(undefined)
  const products = useProducts()
  const categories = useCategories()
  const images = useProductImages()
  const featured = products.data?.filter((p) => p.featured) ?? []

  return (
    <>
      <section className="rounded-card bg-linear-to-br from-purple-100 to-white px-6 py-10 shadow-card">
        <h1 className="mb-3 text-4xl font-bold">Pastelería Luchy</h1>
        <p className="mb-6 max-w-xl text-lg">
          Elige tus pasteles, cupcakes y postres favoritos. Arma tu pedido aquí y lo confirmamos contigo por
          WhatsApp.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/catalogo" className={btnPrimary}>
            Ver catálogo
          </Link>
          <Link to="/carrito" className={btnOutline}>
            Mi carrito
          </Link>
        </div>
      </section>

      <section aria-labelledby="categorias" className="mt-10">
        <h2 id="categorias" className="mb-3 text-2xl font-bold">
          Categorías
        </h2>
        <div className="flex flex-wrap gap-2">
          {categories.data?.map((c) => (
            <Link key={c.id} to={`/catalogo?categoria=${c.slug}`} className={chip}>
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="destacados" className="mt-10">
        <h2 id="destacados" className="mb-3 text-2xl font-bold">
          Destacados
        </h2>
        {products.isPending && <Loading what="los productos destacados" />}
        {products.isError && <LoadError what="los productos destacados" onRetry={() => void products.refetch()} />}
        {products.data && (
          <ProductGrid>
            {featured.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} image={images.data?.find((i) => i.product_id === p.id)} />
              </li>
            ))}
          </ProductGrid>
        )}
      </section>
    </>
  )
}
