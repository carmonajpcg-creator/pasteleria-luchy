import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { describedBy, Field, inputClass } from '../../../../components/Field'
import { Loading, LoadError } from '../../../../components/QueryState'
import { btnPrimary } from '../../../../components/ui'
import { usePageTitle } from '../../../../hooks/usePageTitle'
import { centsToPesosInput } from '../../lib/pesos'
import { slugify } from '../../lib/slugify'
import { useExec } from '../../lib/useExec'
import { getProduct, listCategories, saveProduct, type AdminProduct } from '../api'
import { ImageUploader } from '../components/ImageUploader'
import { productSchema, toProductInput, type ProductValues } from '../schema'

const border = (invalid: boolean) => `${inputClass} ${invalid ? 'border-danger' : 'border-line'}`

function ProductForm({ product }: { product: AdminProduct | null }) {
  const navigate = useNavigate()
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: listCategories })
  const { exec, busy, error } = useExec()
  const {
    register,
    handleSubmit,
    setValue,
    getFieldState,
    control,
    formState: { errors },
  } = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      slug: product?.slug ?? '',
      sku: product?.sku ?? '',
      description: product?.description ?? '',
      categoryId: product?.category_id ?? '',
      price: product ? centsToPesosInput(product.price_cents) : '',
      fulfillmentType: product?.fulfillment_type ?? 'made_to_order',
      leadTimeHours: String(product?.lead_time_hours ?? 0),
      lowStockThreshold: String(product?.low_stock_threshold ?? 3),
      allergens: product?.allergens.join(', ') ?? '',
      allergensVerified: product?.allergens_verified ?? false,
      featured: product?.featured ?? false,
      active: product?.active ?? true,
      allowsCustomization: product?.allows_customization ?? false,
      customizationHint: product?.customization_hint ?? '',
    },
  })
  const allowsCustomization = useWatch({ control, name: 'allowsCustomization' })

  const onSubmit = handleSubmit(async (values) => {
    let savedId = null as string | null
    const ok = await exec(async () => {
      savedId = await saveProduct(product?.id ?? null, toProductInput(values))
    })
    // Un producto nuevo abre su ficha para poder subir imágenes.
    if (ok && !product && savedId) void navigate(`/admin/productos/${savedId}`, { replace: true })
  })

  const f = (name: keyof ProductValues) => ({
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': describedBy(name, { error: Boolean(errors[name]) }),
  })

  return (
    <>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="rounded-card bg-white p-4 shadow-card">
        <Field id="name" label="Nombre" error={errors.name?.message}>
          <input
            id="name"
            className={border(Boolean(errors.name))}
            {...f('name')}
            {...register('name', {
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                if (!product && !getFieldState('slug').isDirty) setValue('slug', slugify(e.target.value))
              },
            })}
          />
        </Field>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field id="sku" label="SKU" error={errors.sku?.message}>
            <input id="sku" className={border(Boolean(errors.sku))} {...f('sku')} {...register('sku')} />
          </Field>
          <Field id="slug" label="Clave de URL" error={errors.slug?.message}>
            <input id="slug" className={border(Boolean(errors.slug))} {...f('slug')} {...register('slug')} />
          </Field>
        </div>
        <Field id="description" label="Descripción" error={errors.description?.message}>
          <textarea id="description" rows={3} className={`${border(Boolean(errors.description))} py-2`} {...f('description')} {...register('description')} />
        </Field>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field id="categoryId" label="Categoría" error={errors.categoryId?.message}>
            <select id="categoryId" className={border(Boolean(errors.categoryId))} {...f('categoryId')} {...register('categoryId')}>
              <option value="">Elige una categoría</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="price" label="Precio (MXN)" hint="Precio provisional hasta que la tienda confirme los reales." error={errors.price?.message}>
            <input
              id="price"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={describedBy('price', { hint: true, error: Boolean(errors.price) })}
              className={border(Boolean(errors.price))}
              {...register('price')}
            />
          </Field>
        </div>
        <div className="grid gap-x-3 sm:grid-cols-3">
          <Field id="fulfillmentType" label="Tipo">
            <select id="fulfillmentType" className={border(false)} {...register('fulfillmentType')}>
              <option value="made_to_order">Bajo pedido</option>
              <option value="stock">Existencia en inventario</option>
            </select>
          </Field>
          <Field id="leadTimeHours" label="Anticipación (horas)" error={errors.leadTimeHours?.message}>
            <input id="leadTimeHours" inputMode="numeric" className={border(Boolean(errors.leadTimeHours))} {...f('leadTimeHours')} {...register('leadTimeHours')} />
          </Field>
          <Field id="lowStockThreshold" label="Aviso de stock bajo" error={errors.lowStockThreshold?.message}>
            <input id="lowStockThreshold" inputMode="numeric" className={border(Boolean(errors.lowStockThreshold))} {...f('lowStockThreshold')} {...register('lowStockThreshold')} />
          </Field>
        </div>
        <p className="-mt-2 mb-4 text-sm text-muted">
          {product
            ? `Existencias actuales: ${product.stock_quantity}. Se ajustan en Inventario (queda registrado cada movimiento).`
            : 'Las existencias se capturan en Inventario después de guardar el producto.'}
        </p>
        <Field id="allergens" label="Alérgenos" hint="Sepáralos con comas (ej. gluten, lácteos, huevo)." error={errors.allergens?.message}>
          <input
            id="allergens"
            aria-describedby={describedBy('allergens', { hint: true, error: Boolean(errors.allergens) })}
            className={border(Boolean(errors.allergens))}
            {...register('allergens')}
          />
        </Field>
        <div className="mb-4 grid gap-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-6" {...register('allowsCustomization')} />
            <span>Admite personalización (el cliente puede escribir qué texto o diseño necesita)</span>
          </label>
        </div>
        {allowsCustomization && (
          <Field
            id="customizationHint"
            label="Pista para el cliente"
            hint="Aparece como ejemplo en el campo de personalización (ej. Texto en el pastel)."
            error={errors.customizationHint?.message}
          >
            <input
              id="customizationHint"
              aria-describedby={describedBy('customizationHint', { hint: true, error: Boolean(errors.customizationHint) })}
              className={border(Boolean(errors.customizationHint))}
              {...register('customizationHint')}
            />
          </Field>
        )}
        <div className="mb-4 grid gap-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-6" {...register('allergensVerified')} />
            <span>
              La tienda verificó esta información de alérgenos. Sin marcar, la tienda muestra «por verificar»; marcada y
              sin alérgenos, muestra «ninguno declarado por la tienda».
            </span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="size-6" {...register('featured')} />
            <span>Destacado en el inicio</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="size-6" {...register('active')} />
            <span>Activo (visible y disponible para pedir). Los productos no se borran: se desactivan.</span>
          </label>
        </div>
        {error && (
          <p role="alert" className="mb-3 text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={`${btnPrimary} disabled:opacity-60`}>
          {busy ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </form>
      {product && <ImageUploader productId={product.id} />}
    </>
  )
}

export function ProductFormPage() {
  const { id } = useParams()
  const isNew = !id
  const product = useQuery({ queryKey: ['admin', 'product', id], queryFn: () => getProduct(id as string), enabled: !isNew })
  usePageTitle(isNew ? 'Nuevo producto' : (product.data?.name ?? 'Producto'))

  const back = (
    <p className="mb-4">
      <Link to="/admin/productos" className="font-semibold text-purple-700 underline">
        ← Volver a productos
      </Link>
    </p>
  )

  if (!isNew && product.isPending) return <Loading what="el producto" />
  if (!isNew && product.isError) return <LoadError what="el producto" onRetry={() => void product.refetch()} />
  if (!isNew && !product.data) {
    return (
      <section>
        {back}
        <h1 className="text-3xl font-bold">Producto no encontrado</h1>
      </section>
    )
  }

  return (
    <section>
      {back}
      <h1 className="mb-4 text-3xl font-bold">{isNew ? 'Nuevo producto' : (product.data?.name ?? 'Producto')}</h1>
      {/* key: al cambiar de producto o recargar tras guardar, el formulario se reinicia con los datos vigentes. */}
      <ProductForm key={product.data?.id ?? 'new'} product={product.data ?? null} />
    </section>
  )
}
