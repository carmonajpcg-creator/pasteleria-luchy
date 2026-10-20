import type { CatalogProduct } from '../types'

// Estado siempre con texto (no solo color). Colores con contraste AA (docs/diseno.md).
export function AvailabilityBadge({ product }: { product: Pick<CatalogProduct, 'available' | 'fulfillment_type'> }) {
  const { label, style } = !product.available
    ? { label: 'Agotado', style: 'bg-[#fee2e2] text-[#7f1d1d]' }
    : product.fulfillment_type === 'made_to_order'
      ? { label: 'Bajo pedido', style: 'bg-[#fef3c7] text-[#78350f]' }
      : { label: 'Disponible', style: 'bg-[#dcfce7] text-[#14532d]' }
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-sm font-semibold ${style}`}>{label}</span>
  )
}
