// Mismos límites que el bucket product-images (el servidor vuelve a validarlos).
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function validateImage(file: { type: string; size: number }): string | null {
  if (!(file.type in EXTENSIONS)) return 'Usa una imagen JPG, PNG o WebP.'
  if (file.size === 0) return 'El archivo está vacío.'
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen pesa más de 2 MB. Reduce su tamaño e inténtalo de nuevo.'
  return null
}

/** Ruta en el bucket: nombre aleatorio (no se conserva el nombre original del archivo). */
export function imageStoragePath(productId: string, mimeType: string, random: string = crypto.randomUUID()): string {
  return `products/${productId}/${random}.${EXTENSIONS[mimeType] ?? 'bin'}`
}
