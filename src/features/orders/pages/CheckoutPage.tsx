import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Field, inputClass } from '../../../components/Field'
import { Loading, LoadError } from '../../../components/QueryState'
import { btnPrimary } from '../../../components/ui'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { formatMXN } from '../../../lib/money'
import { useStoreSettings } from '../../catalog/hooks'
import { useCart } from '../../cart/store'
import { useCartLines } from '../../cart/useCartLines'
import { createOrder, OrderError } from '../api'
import { useAvailability } from '../availability'
import { firstAvailableDay } from '../availabilityDays'
import { makeCheckoutSchema, maxRequestedDate, minRequestedDate, type CheckoutValues } from '../schema'
import { attemptKey, clearAttempt, saveExtras } from '../session'

const input = inputClass

export function CheckoutPage() {
  usePageTitle('Checkout')
  const navigate = useNavigate()
  const clearCart = useCart((s) => s.clear)
  const { items, lines, missing, unavailable, totalCents, products } = useCartLines()
  const settings = useStoreSettings()
  const submitting = useRef(false)

  const maxLead = Math.max(0, ...lines.map((l) => l.product.lead_time_hours))
  const hasMadeToOrder = lines.some((l) => l.product.fulfillment_type === 'made_to_order')
  // Si la configuración no carga se usa UTC (valor por defecto de la tienda); el servidor decide.
  const localMin = minRequestedDate(maxLead, settings.data?.timezone ?? 'UTC')

  // El esquema depende de la disponibilidad, y la disponibilidad de la modalidad elegida: el resolver
  // lee el esquema vigente desde una referencia para no recrear el formulario.
  const schemaRef = useRef(makeCheckoutSchema(localMin))
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues>({
    resolver: (values, context, options) => zodResolver(schemaRef.current)(values, context, options),
    defaultValues: { name: '', phone: '', email: '', fulfillment: 'pickup', requestedDate: '', notes: '', privacy: false },
  })
  const fulfillment = useWatch({ control, name: 'fulfillment' })

  // Días cerrados, sin recolección, sin cupo o sin anticipación según el servidor. Si no se puede
  // consultar, la validación definitiva sigue siendo la de create_order.
  const availability = useAvailability(maxLead, hasMadeToOrder, fulfillment, lines.length > 0)
  const days = availability.data
  const firstDay = days ? firstAvailableDay(days) : null
  const minDate = firstDay ?? localMin
  const schema = useMemo(() => makeCheckoutSchema(minDate, days ?? []), [minDate, days])
  useEffect(() => {
    schemaRef.current = schema
  }, [schema])

  const mutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (order, vars) => {
      saveExtras(order.folio, {
        customerName: vars.name,
        notes: vars.notes,
        customizations: Object.fromEntries(
          lines.filter((l) => l.item.customization).map((l) => [l.product.name, l.item.customization as string]),
        ),
      })
      clearAttempt()
      clearCart()
      void navigate(`/pedido/${order.folio}?t=${order.public_token}`, { replace: true })
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const orderItems = lines
        .map((l) => ({ productId: l.product.id, quantity: l.item.quantity, customization: l.item.customization }))
        .sort((a, b) => a.productId.localeCompare(b.productId))
      // Mismo contenido → misma clave (reintentos y doble clic no duplican el pedido).
      const idempotencyKey = await attemptKey({ orderItems, values })
      await mutation.mutateAsync({
        idempotencyKey,
        name: values.name,
        phone: values.phone,
        email: values.email,
        fulfillment: values.fulfillment,
        requestedDate: values.requestedDate,
        notes: values.notes,
        privacyAccepted: values.privacy,
        items: orderItems,
      })
    } catch {
      /* el error se muestra desde mutation.error */
    }
  })

  // Candado síncrono: un segundo clic llega antes de que el botón se vuelva a pintar deshabilitado.
  const submitOnce = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    void onSubmit(e).finally(() => {
      submitting.current = false
    })
  }

  if (items.length === 0) {
    return (
      <section>
        <h1 className="mb-4 text-3xl font-bold">Checkout</h1>
        <div className="rounded-card bg-white p-6 shadow-card">
          <p className="mb-4">Tu carrito está vacío.</p>
          <Link to="/catalogo" className={btnPrimary}>
            Ver catálogo
          </Link>
        </div>
      </section>
    )
  }
  if (products.isPending) return <Loading what="tu pedido" />
  if (products.isError) return <LoadError what="tu pedido" onRetry={() => void products.refetch()} />

  const blocked = missing.length > 0 || unavailable.length > 0
  const invalid = (name: keyof CheckoutValues) => (errors[name] ? true : undefined)
  const describedBy = (name: keyof CheckoutValues) => (errors[name] ? `${name}-error` : undefined)

  return (
    <section>
      <h1 className="mb-4 text-3xl font-bold">Checkout</h1>
      <div className="grid items-start gap-6 md:grid-cols-2">
        <section aria-labelledby="resumen" className="rounded-card bg-white p-4 shadow-card">
          <h2 id="resumen" className="mb-2 text-xl font-bold">
            Tu pedido
          </h2>
          <ul className="divide-y divide-line">
            {lines.map(({ item, product, lineTotalCents }) => (
              <li key={product.id} className="flex justify-between gap-2 py-2">
                <span>
                  {item.quantity} × {product.name}
                  {item.customization && <span className="block text-sm text-muted">{item.customization}</span>}
                </span>
                <span>{formatMXN(lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between text-lg font-semibold">
            <span>Total estimado</span>
            <span>{formatMXN(totalCents)}</span>
          </p>
          <p className="text-sm text-muted">
            El total final lo confirma la tienda; los precios se validan al registrar el pedido.
          </p>
          {blocked && (
            <p role="alert" className="mt-2 text-danger">
              Hay productos agotados o que ya no están en el catálogo.{' '}
              <Link to="/carrito" className="font-semibold underline">
                Revisa tu carrito
              </Link>
              .
            </p>
          )}
        </section>

        <section aria-labelledby="datos" className="rounded-card bg-white p-4 shadow-card">
          <h2 id="datos" className="mb-2 text-xl font-bold">
            Tus datos
          </h2>
          <p className="mb-4 text-sm text-muted">
            Solo pedimos los datos necesarios para preparar y entregar tu pedido. Consulta el{' '}
            <Link to="/privacidad" className="font-semibold text-purple-700 underline">
              aviso de privacidad
            </Link>{' '}
            antes de continuar.
          </p>

          <form onSubmit={submitOnce} noValidate>
            <Field id="name" label="Nombre" error={errors.name?.message}>
              <input
                id="name"
                autoComplete="name"
                aria-invalid={invalid('name')}
                aria-describedby={describedBy('name')}
                className={`${input} ${errors.name ? 'border-danger' : 'border-line'}`}
                {...register('name')}
              />
            </Field>
            <Field id="phone" label="Teléfono / WhatsApp" error={errors.phone?.message}>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                aria-invalid={invalid('phone')}
                aria-describedby={describedBy('phone')}
                className={`${input} ${errors.phone ? 'border-danger' : 'border-line'}`}
                {...register('phone')}
              />
            </Field>
            <Field id="email" label="Correo (opcional)" error={errors.email?.message}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={invalid('email')}
                aria-describedby={describedBy('email')}
                className={`${input} ${errors.email ? 'border-danger' : 'border-line'}`}
                {...register('email')}
              />
            </Field>
            <Field id="fulfillment" label="Modalidad" error={errors.fulfillment?.message}>
              <select id="fulfillment" className={`${input} border-line`} {...register('fulfillment')}>
                <option value="pickup">Recolección en tienda</option>
                <option value="delivery">Entrega a domicilio</option>
              </select>
            </Field>
            <Field id="requestedDate" label="Fecha solicitada" error={errors.requestedDate?.message}>
              <input
                id="requestedDate"
                type="date"
                min={minDate}
                max={maxRequestedDate(minDate)}
                aria-invalid={invalid('requestedDate')}
                aria-describedby={`requestedDate-hint ${describedBy('requestedDate') ?? ''}`.trim()}
                className={`${input} ${errors.requestedDate ? 'border-danger' : 'border-line'}`}
                {...register('requestedDate')}
              />
              <span id="requestedDate-hint" className="text-sm text-muted">
                {days && !firstDay
                  ? 'Por ahora no hay fechas disponibles en los próximos meses. Escríbenos por WhatsApp desde Contacto.'
                  : `Primera fecha disponible: ${minDate.split('-').reverse().join('/')}.`}{' '}
                {hasMadeToOrder && maxLead > 0 && 'Tu pedido incluye productos bajo pedido con anticipación mínima. '}
                La tienda confirmará la fecha final.
              </span>
            </Field>
            <Field id="notes" label="Notas (opcional)" error={errors.notes?.message}>
              <textarea
                id="notes"
                rows={2}
                aria-invalid={invalid('notes')}
                aria-describedby={describedBy('notes')}
                className={`${input} py-2 ${errors.notes ? 'border-danger' : 'border-line'}`}
                {...register('notes')}
              />
            </Field>

            <div className="mb-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-6 flex-none"
                  aria-invalid={invalid('privacy')}
                  aria-describedby={describedBy('privacy')}
                  {...register('privacy')}
                />
                <span>
                  Acepto el{' '}
                  <Link to="/privacidad" className="font-semibold text-purple-700 underline">
                    aviso de privacidad
                  </Link>{' '}
                  y las{' '}
                  <Link to="/condiciones" className="font-semibold text-purple-700 underline">
                    condiciones de pedido
                  </Link>
                  .
                </span>
              </label>
              {errors.privacy && (
                <span id="privacy-error" role="alert" className="text-sm text-danger">
                  {errors.privacy.message}
                </span>
              )}
            </div>

            <p id="wa-note" role="note" className="mb-4 rounded-xl bg-purple-100 p-3 text-sm">
              Al registrar tu pedido recibirás un <strong>folio</strong> y te llevaremos a WhatsApp con el mensaje ya
              escrito; <strong>tú decides si lo envías</strong>. El pedido <strong>no está confirmado</strong> hasta
              que la tienda te responda y lo confirme.
            </p>

            {mutation.isError && (
              <p role="alert" className="mb-4 text-danger">
                {mutation.error instanceof OrderError
                  ? mutation.error.message
                  : 'No pudimos registrar tu pedido. Revisa tu conexión e inténtalo de nuevo.'}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || blocked}
              aria-describedby="wa-note"
              className={`${btnPrimary} w-full disabled:opacity-60`}
            >
              {isSubmitting ? 'Registrando…' : 'Registrar pedido'}
            </button>
          </form>
        </section>
      </div>
    </section>
  )
}
