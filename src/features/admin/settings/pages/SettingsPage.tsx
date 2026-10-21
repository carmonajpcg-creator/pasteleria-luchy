import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'

import { describedBy, Field, inputClass } from '../../../../components/Field'
import { Loading, LoadError } from '../../../../components/QueryState'
import { btnPrimary } from '../../../../components/ui'
import { usePageTitle } from '../../../../hooks/usePageTitle'
import { db, unwrap } from '../../lib/client'
import { useExec } from '../../lib/useExec'
import { settingsSchema, toSettingsPatch, type SettingsValues, type StoreSettingsRow } from '../schema'

const COLUMNS =
  'store_name, whatsapp_number, contact_email, contact_phone, schedule_text, coverage_text, timezone, order_expiry_hours, closed_weekdays, pickup_closed_weekdays, closed_dates, daily_capacity, min_lead_hours'

const WEEKDAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

const getSettings = () => unwrap<StoreSettingsRow>(db().from('store_settings').select(COLUMNS).single())

async function saveSettings(patch: StoreSettingsRow) {
  const { error } = await db().from('store_settings').update(patch).eq('id', true)
  if (error) throw error
}

const border = (invalid: boolean) => `${inputClass} ${invalid ? 'border-danger' : 'border-line'}`

function SettingsForm({ settings }: { settings: StoreSettingsRow }) {
  const { exec, busy, error } = useExec()
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitSuccessful },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      storeName: settings.store_name,
      whatsapp: settings.whatsapp_number ?? '',
      contactEmail: settings.contact_email ?? '',
      contactPhone: settings.contact_phone ?? '',
      scheduleText: settings.schedule_text ?? '',
      coverageText: settings.coverage_text ?? '',
      timezone: settings.timezone,
      orderExpiryHours: String(settings.order_expiry_hours),
      closedWeekdays: settings.closed_weekdays,
      pickupClosedWeekdays: settings.pickup_closed_weekdays,
      closedDates: settings.closed_dates.join('\n'),
      dailyCapacity: settings.daily_capacity === null ? '' : String(settings.daily_capacity),
      minLeadHours: String(settings.min_lead_hours),
      confirmWhatsapp: false,
    },
  })

  // Cambiar el número de WhatsApp afecta todos los pedidos nuevos: se pide confirmación explícita.
  const whatsappValue = useWatch({ control, name: 'whatsapp' })
  const whatsappChanged = whatsappValue.trim() !== (settings.whatsapp_number ?? '')

  const onSubmit = handleSubmit(async (values) => {
    if (whatsappChanged && !values.confirmWhatsapp) {
      setError('confirmWhatsapp', { message: 'Marca la casilla para confirmar el cambio de número.' })
      return
    }
    await exec(() => saveSettings(toSettingsPatch(values)))
  })

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="max-w-2xl rounded-card bg-white p-4 shadow-card">
      <Field id="storeName" label="Nombre de la tienda" error={errors.storeName?.message}>
        <input id="storeName" aria-invalid={errors.storeName ? true : undefined} aria-describedby={describedBy('storeName', { error: Boolean(errors.storeName) })} className={border(Boolean(errors.storeName))} {...register('storeName')} />
      </Field>
      <Field
        id="whatsapp"
        label="WhatsApp de la tienda"
        hint="Formato internacional, solo dígitos y sin «+» (México: 52 + 10 dígitos). Los clientes enviarán sus pedidos a este número."
        error={errors.whatsapp?.message}
      >
        <input
          id="whatsapp"
          inputMode="numeric"
          aria-invalid={errors.whatsapp ? true : undefined}
          aria-describedby={describedBy('whatsapp', { hint: true, error: Boolean(errors.whatsapp) })}
          className={border(Boolean(errors.whatsapp))}
          {...register('whatsapp')}
        />
      </Field>
      {whatsappChanged && (
        <div className="mb-4 rounded-xl bg-purple-100 p-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-6 flex-none"
              aria-invalid={errors.confirmWhatsapp ? true : undefined}
              aria-describedby={errors.confirmWhatsapp ? 'confirmWhatsapp-error' : undefined}
              {...register('confirmWhatsapp')}
            />
            <span>Confirmo que este es el número correcto: todos los pedidos nuevos se enviarán a él.</span>
          </label>
          {errors.confirmWhatsapp && (
            <span id="confirmWhatsapp-error" role="alert" className="text-sm text-danger">
              {errors.confirmWhatsapp.message}
            </span>
          )}
        </div>
      )}
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field id="contactEmail" label="Correo de contacto" error={errors.contactEmail?.message}>
          <input id="contactEmail" type="email" aria-invalid={errors.contactEmail ? true : undefined} aria-describedby={describedBy('contactEmail', { error: Boolean(errors.contactEmail) })} className={border(Boolean(errors.contactEmail))} {...register('contactEmail')} />
        </Field>
        <Field id="contactPhone" label="Teléfono de contacto" error={errors.contactPhone?.message}>
          <input id="contactPhone" type="tel" className={border(Boolean(errors.contactPhone))} {...register('contactPhone')} />
        </Field>
      </div>
      <Field id="scheduleText" label="Horarios" error={errors.scheduleText?.message}>
        <textarea id="scheduleText" rows={2} className={`${border(Boolean(errors.scheduleText))} py-2`} {...register('scheduleText')} />
      </Field>
      <Field id="coverageText" label="Cobertura de entregas" error={errors.coverageText?.message}>
        <textarea id="coverageText" rows={2} className={`${border(Boolean(errors.coverageText))} py-2`} {...register('coverageText')} />
      </Field>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field id="timezone" label="Zona horaria" hint="Define la fecha mínima de entrega. Ej. America/Matamoros." error={errors.timezone?.message}>
          <input id="timezone" aria-invalid={errors.timezone ? true : undefined} aria-describedby={describedBy('timezone', { hint: true, error: Boolean(errors.timezone) })} className={border(Boolean(errors.timezone))} {...register('timezone')} />
        </Field>
        <Field id="orderExpiryHours" label="Caducidad de pedidos sin confirmar (horas)" error={errors.orderExpiryHours?.message}>
          <input id="orderExpiryHours" inputMode="numeric" aria-invalid={errors.orderExpiryHours ? true : undefined} aria-describedby={describedBy('orderExpiryHours', { error: Boolean(errors.orderExpiryHours) })} className={border(Boolean(errors.orderExpiryHours))} {...register('orderExpiryHours')} />
        </Field>
      </div>
      <fieldset className="mb-4 rounded-xl border border-line p-4">
        <legend className="px-1 font-semibold">Pedidos y fechas</legend>
        <p className="mb-3 text-sm text-muted">
          Define cuándo recibe pedidos la tienda. Sin límite y sin días cerrados por defecto: la política real la decide
          el negocio.
        </p>
        <Controller
          control={control}
          name="pickupClosedWeekdays"
          render={({ field }) => (
            <fieldset className="mb-4">
              <legend className="mb-1 font-semibold">Días sin recolección en tienda (sí hay entrega a domicilio)</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {WEEKDAYS.map((d) => (
                  <label key={d.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-6"
                      aria-label={`Sin recolección el ${d.label.toLowerCase()}`}
                      checked={field.value.includes(d.value)}
                      onChange={(e) =>
                        field.onChange(e.target.checked ? [...field.value, d.value] : field.value.filter((v) => v !== d.value))
                      }
                    />
                    <span aria-hidden="true">{d.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        />
        <Controller
          control={control}
          name="closedWeekdays"
          render={({ field }) => (
            <fieldset className="mb-4">
              <legend className="mb-1 font-semibold">Días de la semana sin pedidos</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {WEEKDAYS.map((d) => (
                  <label key={d.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-6"
                      checked={field.value.includes(d.value)}
                      onChange={(e) =>
                        field.onChange(e.target.checked ? [...field.value, d.value] : field.value.filter((v) => v !== d.value))
                      }
                    />
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
              {errors.closedWeekdays && (
                <span role="alert" className="text-sm text-danger">
                  {errors.closedWeekdays.message}
                </span>
              )}
            </fieldset>
          )}
        />
        <Field
          id="closedDates"
          label="Fechas cerradas (vacaciones, festivos)"
          hint="Una por línea o separadas por comas, formato AAAA-MM-DD (ej. 2026-12-25)."
          error={errors.closedDates?.message}
        >
          <textarea
            id="closedDates"
            rows={3}
            aria-invalid={errors.closedDates ? true : undefined}
            aria-describedby={describedBy('closedDates', { hint: true, error: Boolean(errors.closedDates) })}
            className={`${border(Boolean(errors.closedDates))} py-2`}
            {...register('closedDates')}
          />
        </Field>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field
            id="dailyCapacity"
            label="Capacidad diaria (pedidos bajo pedido)"
            hint="Máximo de pedidos con productos bajo pedido por fecha. Vacío = sin límite."
            error={errors.dailyCapacity?.message}
          >
            <input
              id="dailyCapacity"
              inputMode="numeric"
              aria-invalid={errors.dailyCapacity ? true : undefined}
              aria-describedby={describedBy('dailyCapacity', { hint: true, error: Boolean(errors.dailyCapacity) })}
              className={border(Boolean(errors.dailyCapacity))}
              {...register('dailyCapacity')}
            />
          </Field>
          <Field
            id="minLeadHours"
            label="Anticipación general (horas)"
            hint="Mínimo para cualquier pedido, además de la de cada producto."
            error={errors.minLeadHours?.message}
          >
            <input
              id="minLeadHours"
              inputMode="numeric"
              aria-invalid={errors.minLeadHours ? true : undefined}
              aria-describedby={describedBy('minLeadHours', { hint: true, error: Boolean(errors.minLeadHours) })}
              className={border(Boolean(errors.minLeadHours))}
              {...register('minLeadHours')}
            />
          </Field>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="mb-3 text-danger">
          {error}
        </p>
      )}
      {isSubmitSuccessful && !error && !busy && (
        <p role="status" className="mb-3 text-green-700">
          Cambios guardados.
        </p>
      )}
      <button type="submit" disabled={busy} className={`${btnPrimary} disabled:opacity-60`}>
        {busy ? 'Guardando…' : 'Guardar configuración'}
      </button>
    </form>
  )
}

export function SettingsPage() {
  usePageTitle('Configuración')
  const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: getSettings })
  return (
    <section>
      <h1 className="mb-4 text-3xl font-bold">Configuración</h1>
      {settings.isPending && <Loading what="la configuración" />}
      {settings.isError && <LoadError what="la configuración" onRetry={() => void settings.refetch()} />}
      {settings.data && <SettingsForm settings={settings.data} />}
    </section>
  )
}
