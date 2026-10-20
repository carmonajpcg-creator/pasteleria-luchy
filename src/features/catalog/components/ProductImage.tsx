import { productImageUrl } from '../api'
import type { ProductImage as ProductImageData } from '../types'

interface Props {
  name: string
  image?: ProductImageData
  className?: string
}

// Sin foto aún (demo): marcador identificado como ejemplo, nunca una foto con licencia dudosa.
export function ProductImage({ name, image, className = 'aspect-4/3' }: Props) {
  if (!image) {
    return (
      <div
        role="img"
        aria-label={`Imagen de ejemplo de ${name}`}
        className={`flex w-full items-center justify-center bg-linear-to-br from-purple-100 to-green-300 p-3 text-center text-sm font-semibold text-ink ${className}`}
      >
        Imagen de ejemplo
      </div>
    )
  }
  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <img
        src={productImageUrl(image.storage_path)}
        alt={image.alt || name}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      {image.is_demo && (
        <span className="absolute bottom-2 left-2 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink">
          Imagen de ejemplo
        </span>
      )}
    </div>
  )
}
