import { useProducts } from '../catalog/hooks'
import type { CatalogProduct } from '../catalog/types'
import { useCart, type CartItem } from './store'

export interface CartLine {
  item: CartItem
  product: CatalogProduct
  lineTotalCents: number
}

// Une el carrito local con el catálogo vigente. El total es solo una estimación para mostrar:
// el backend recalcula precios y disponibilidad al crear el pedido.
export function useCartLines() {
  const items = useCart((s) => s.items)
  const products = useProducts()

  const lines: CartLine[] = []
  const missing: CartItem[] = []
  if (products.data) {
    for (const item of items) {
      const product = products.data.find((p) => p.id === item.productId)
      if (product) lines.push({ item, product, lineTotalCents: product.price_cents * item.quantity })
      else missing.push(item)
    }
  }
  const totalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0)
  const unavailable = lines.filter((l) => !l.product.available)

  return { items, lines, missing, unavailable, totalCents, products }
}
