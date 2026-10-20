import { Link } from 'react-router-dom'
import { btnPrimary } from '../../../components/ui'
import { formatMXN } from '../../../lib/money'
import type { CatalogProduct, ProductImage as ProductImageData } from '../types'
import { AvailabilityBadge } from './AvailabilityBadge'
import { ProductImage } from './ProductImage'

interface Props {
  product: CatalogProduct
  image?: ProductImageData
  headingLevel?: 'h2' | 'h3'
}

export function ProductCard({ product, image, headingLevel: Heading = 'h3' }: Props) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card bg-white shadow-card">
      <ProductImage name={product.name} image={image} />
      <div className="flex flex-1 flex-col items-start gap-2 p-4">
        <Heading className="text-base font-semibold">{product.name}</Heading>
        <AvailabilityBadge product={product} />
        <p className="font-semibold">{formatMXN(product.price_cents)}</p>
        <p className="text-sm text-muted">Precio provisional</p>
        <Link to={`/producto/${product.slug}`} className={`${btnPrimary} mt-auto`}>
          Ver detalle<span className="sr-only"> de {product.name}</span>
        </Link>
      </div>
    </article>
  )
}

export function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">{children}</ul>
  )
}
