import { productImageUrl } from '../api'
import type { ProductImage as ProductImageData } from '../types'
import { demoImageFor } from '../demoImages'

interface Props {
  name: string
  image?: ProductImageData
  className?: string
  demoLabel?: string
}

// Sin foto real: fotografía ilustrativa local identificada como ejemplo.
export function ProductImage({ name, image, className = 'aspect-4/3', demoLabel = 'Imagen de ejemplo' }: Props) {
  if (!image) {
    return (
      <div className={`product-photo relative w-full overflow-hidden ${className}`}>
        <img src={demoImageFor(name)} alt={`Imagen de ejemplo de ${name}`} width="1024" height="1024" loading="lazy" className="h-full w-full object-cover" />
        <span className="demo-caption">{demoLabel}</span>
      </div>
    )
  }
  return (
    <div className={`product-photo relative w-full overflow-hidden ${className}`}>
      <img
        src={productImageUrl(image.storage_path)}
        alt={image.alt || name}
        loading="lazy"
        width="1024"
        height="1024"
        className="h-full w-full object-cover"
      />
      {image.is_demo && (
        <span className="demo-caption">
          {demoLabel}
        </span>
      )}
    </div>
  )
}
