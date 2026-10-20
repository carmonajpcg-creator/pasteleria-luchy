import { useSearchParams } from 'react-router-dom'
import { Loading, LoadError } from '../../../components/QueryState'
import { chip, chipActive } from '../../../components/ui'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { ProductCard, ProductGrid } from '../components/ProductCard'
import { filterProducts } from '../filter'
import { useCategories, useProductImages, useProducts } from '../hooks'

export function CatalogPage() {
  usePageTitle('Catálogo')
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const category = params.get('categoria') ?? ''

  const products = useProducts()
  const categories = useCategories()
  const images = useProductImages()

  // Filtros en la URL: enlaces compartibles y recarga sin perder el estado.
  const update = (next: { q?: string; categoria?: string }) => {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value)
      else merged.delete(key)
    }
    setParams(merged, { replace: true })
  }

  const visible = products.data ? filterProducts(products.data, { query, category }) : []
  const imageFor = (id: string) => images.data?.find((i) => i.product_id === id)

  return (
    <section>
      <h1 className="mb-4 text-3xl font-bold">Catálogo</h1>

      <form role="search" onSubmit={(e) => e.preventDefault()} className="mb-4 flex flex-col gap-1">
        <label htmlFor="busqueda" className="font-semibold">
          Buscar productos
        </label>
        <input
          id="busqueda"
          type="search"
          value={query}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="Ej. chocolate, fresa…"
          className="min-h-12 rounded-xl border border-line bg-white px-4"
        />
      </form>

      <div role="group" aria-label="Filtrar por categoría" className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={category === ''}
          className={category === '' ? chipActive : chip}
          onClick={() => update({ categoria: '' })}
        >
          Todos
        </button>
        {categories.data?.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={category === c.slug}
            className={category === c.slug ? chipActive : chip}
            onClick={() => update({ categoria: c.slug })}
          >
            {c.name}
          </button>
        ))}
      </div>

      {products.isPending && <Loading what="el catálogo" />}
      {products.isError && <LoadError what="el catálogo" onRetry={() => void products.refetch()} />}

      {products.data && (
        <>
          <p role="status" className="mb-4 text-muted">
            {visible.length} {visible.length === 1 ? 'producto' : 'productos'}
          </p>
          {visible.length === 0 ? (
            <div className="rounded-card bg-white p-6 shadow-card">
              <p>No encontramos productos con esos filtros.</p>
              <button
                type="button"
                className="mt-2 min-h-12 font-semibold text-purple-700 underline"
                onClick={() => update({ q: '', categoria: '' })}
              >
                Quitar filtros
              </button>
            </div>
          ) : (
            <>
              <h2 className="sr-only">Productos</h2>
              <ProductGrid>
                {visible.map((p) => (
                  <li key={p.id}>
                    <ProductCard product={p} image={imageFor(p.id)} headingLevel="h3" />
                  </li>
                ))}
              </ProductGrid>
            </>
          )}
        </>
      )}
    </section>
  )
}
