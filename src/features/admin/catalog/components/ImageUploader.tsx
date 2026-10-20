import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Loading, LoadError } from '../../../../components/QueryState'
import { productImageUrl } from '../../../catalog/api'
import { validateImage } from '../../lib/image'
import { useExec } from '../../lib/useExec'
import { deleteProductImage, listProductImages, updateProductImage, uploadProductImage, type AdminImage } from '../api'

function ImageRow({ image, disabled, onSave, onDelete }: {
  image: AdminImage
  disabled: boolean
  onSave: (patch: { alt: string; is_demo: boolean }) => void
  onDelete: () => void
}) {
  const [alt, setAlt] = useState(image.alt)
  const [demo, setDemo] = useState(image.is_demo)
  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[96px_1fr] sm:items-start">
      <img src={productImageUrl(image.storage_path)} alt={image.alt || 'Imagen del producto'} className="h-24 w-24 rounded-xl object-cover" />
      <div className="grid gap-2">
        <label className="grid gap-1">
          <span className="font-semibold">Texto alternativo</span>
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            maxLength={200}
            className="min-h-12 rounded-xl border border-line bg-white px-4"
          />
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="size-6" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          <span>Imagen de ejemplo (se muestra con la etiqueta «Imagen de ejemplo»)</span>
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={disabled}
            className="min-h-12 font-semibold text-purple-700 underline disabled:opacity-60"
            onClick={() => onSave({ alt, is_demo: demo })}
          >
            Guardar imagen
          </button>
          <button
            type="button"
            disabled={disabled}
            className="min-h-12 font-semibold text-danger underline disabled:opacity-60"
            onClick={() => {
              if (window.confirm('¿Eliminar esta imagen?')) onDelete()
            }}
          >
            Eliminar imagen
          </button>
        </div>
      </div>
    </li>
  )
}

export function ImageUploader({ productId }: { productId: string }) {
  const images = useQuery({ queryKey: ['admin', 'images', productId], queryFn: () => listProductImages(productId) })
  const { exec, busy, error } = useExec()
  const [fileError, setFileError] = useState<string | null>(null)

  const nextOrder = (images.data?.reduce((max, i) => Math.max(max, i.sort_order), 0) ?? 0) + 1

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problem = validateImage(file)
    setFileError(problem)
    if (problem) return
    void exec(() => uploadProductImage(productId, file, '', nextOrder))
  }

  return (
    <section aria-labelledby="imagenes-titulo" className="mt-6 rounded-card bg-white p-4 shadow-card">
      <h2 id="imagenes-titulo" className="mb-1 text-xl font-bold">
        Imágenes
      </h2>
      <p className="mb-3 text-sm text-muted">
        JPG, PNG o WebP de hasta 2 MB. Sube solo fotos propias o con licencia; mientras no lo sean, déjalas marcadas como
        «de ejemplo».
      </p>
      <label className="grid gap-1">
        <span className="font-semibold">Agregar imagen</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={onFile} className="min-h-12" />
      </label>
      {(fileError || error) && (
        <p role="alert" className="mt-2 text-danger">
          {fileError ?? error}
        </p>
      )}
      {busy && <p role="status" className="mt-2 text-muted">Subiendo…</p>}
      {images.isPending && <Loading what="las imágenes" />}
      {images.isError && <LoadError what="las imágenes" onRetry={() => void images.refetch()} />}
      {images.data && (
        <ul className="mt-3 divide-y divide-line">
          {images.data.map((img) => (
            <ImageRow
              key={img.id}
              image={img}
              disabled={busy}
              onSave={(patch) => void exec(() => updateProductImage(img.id, patch))}
              onDelete={() => void exec(() => deleteProductImage(img))}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
