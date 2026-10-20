import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { inputClass } from '../../../../components/Field'
import { Loading, LoadError } from '../../../../components/QueryState'
import { btnPrimary } from '../../../../components/ui'
import { usePageTitle } from '../../../../hooks/usePageTitle'
import { formatMXN } from '../../../../lib/money'
import { filterText } from '../../lib/filterText'
import { listCategories, listProducts } from '../api'

export function ProductsPage() {
  usePageTitle('Productos')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const category = params.get('categoria') ?? ''

  const products = useQuery({ queryKey: ['admin', 'products'], queryFn: listProducts })
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: listCategories })

  const update = (next: { q?: string; categoria?: string }) => {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value)
      else merged.delete(key)
    }
    setParams(merged, { replace: true })
  }

  const categoryName = (id: string) => categories.data?.find((c) => c.id === id)?.name ?? '—'
  const visible = (products.data ?? []).filter(
    (p) => (!category || p.category_id === category) && filterText(q, `${p.name} ${p.sku}`),
  )

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Productos</h1>
        <Link to="/admin/productos/nuevo" className={btnPrimary}>
          Nuevo producto
        </Link>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="font-semibold">
            Buscar por nombre o SKU
          </label>
          <input
            id="q"
            type="search"
            value={q}
            onChange={(e) => update({ q: e.target.value })}
            className={`${inputClass} border-line`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="categoria" className="font-semibold">
            Categoría
          </label>
          <select
            id="categoria"
            value={category}
            onChange={(e) => update({ categoria: e.target.value })}
            className={`${inputClass} border-line`}
          >
            <option value="">Todas</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {products.isPending && <Loading what="los productos" />}
      {products.isError && <LoadError what="los productos" onRetry={() => void products.refetch()} />}
      {products.data && (
        <>
          <p role="status" className="mb-3 text-muted">
            {visible.length} {visible.length === 1 ? 'producto' : 'productos'}
          </p>
          <ul className="grid gap-3">
            {visible.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-white p-4 shadow-card">
                <div>
                  <p className="font-semibold">
                    <Link to={`/admin/productos/${p.id}`} className="text-purple-700 underline">
                      {p.name}
                    </Link>
                  </p>
                  <p className="text-sm text-muted">
                    {p.sku} · {categoryName(p.category_id)} ·{' '}
                    {p.fulfillment_type === 'stock' ? `${p.stock_quantity} en existencia` : 'Bajo pedido'}
                  </p>
                  <p className="text-sm">{p.active ? 'Activo' : 'Inactivo (oculto en la tienda)'}</p>
                </div>
                <p className="font-semibold">{formatMXN(p.price_cents)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
