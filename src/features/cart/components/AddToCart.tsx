import { useState } from 'react'
import { Link } from 'react-router-dom'
import { btnPrimary } from '../../../components/ui'
import type { CatalogProduct } from '../../catalog/types'
import { MAX_CUSTOMIZATION, useCart } from '../store'
import { QuantitySelector } from './QuantitySelector'

export function AddToCart({ product }: { product: CatalogProduct }) {
  const add = useCart((s) => s.add)
  const [quantity, setQuantity] = useState(1)
  const [customization, setCustomization] = useState('')
  const [feedback, setFeedback] = useState<'added' | 'full' | null>(null)

  if (!product.available) {
    return (
      <p role="note" className="rounded-xl bg-purple-100 p-3">
        Este producto está agotado por ahora.
      </p>
    )
  }

  return (
    <form
      className="grid w-full gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        setFeedback(add(product.id, quantity, customization) ? 'added' : 'full')
      }}
    >
      <div>
        <p className="mb-1 font-semibold">Cantidad</p>
        <QuantitySelector name={product.name} value={quantity} onChange={setQuantity} />
      </div>
      {product.allows_customization && (
        <div className="flex flex-col gap-1">
          <label htmlFor="customization" className="font-semibold">
            Personalización (opcional)
          </label>
          <textarea
            id="customization"
            rows={2}
            maxLength={MAX_CUSTOMIZATION}
            value={customization}
            onChange={(e) => setCustomization(e.target.value)}
            placeholder={product.customization_hint ?? 'Ej. texto o diseño que necesitas'}
            aria-describedby="customization-help"
            className="min-h-12 rounded-xl border border-line bg-white px-4 py-2"
          />
          <span id="customization-help" className="text-sm text-muted">
            {customization.length}/{MAX_CUSTOMIZATION} · La tienda confirmará contigo si puede hacerlo.
          </span>
        </div>
      )}
      <button type="submit" className={`${btnPrimary} w-full sm:w-auto`}>
        Agregar al carrito
      </button>
      <div role="status">
        {feedback === 'added' && (
          <p>
            Agregado al carrito.{' '}
            <Link to="/carrito" className="font-semibold text-purple-700 underline">
              Ver carrito
            </Link>
          </p>
        )}
        {feedback === 'full' && <p className="text-danger">Tu carrito ya tiene el máximo de productos distintos.</p>}
      </div>
    </form>
  )
}
