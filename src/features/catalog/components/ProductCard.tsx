import { Link } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
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
    <article className="product-card">
      <Link to={`/producto/${product.slug}`} className="product-picture-link" aria-label={`Explorar ${product.name}`}><ProductImage name={product.name} image={image} /></Link>
      <div className="product-card-body">
        <p className="product-category">{product.category_name}</p>
        <Heading><Link to={`/producto/${product.slug}`}>{product.name}</Link></Heading>
        <AvailabilityBadge product={product} />
        <div className="product-card-bottom">
          <div><p className="product-price">{formatMXN(product.price_cents)}</p><p className="text-sm text-muted">Precio provisional</p></div>
          <Link to={`/producto/${product.slug}`} className="product-detail-link"><span className="sr-only">Ver detalle de {product.name}</span><Icon name="arrow" /></Link>
        </div>
      </div>
    </article>
  )
}

export function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <ul className="product-grid">{children}</ul>
  )
}
