import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { describedBy, Field, inputClass } from '../../../../components/Field'
import { btnPrimary } from '../../../../components/ui'
import { parsePesos } from '../../lib/pesos'
import { useExec } from '../../lib/useExec'
import { addPayment } from '../api'

const schema = z.object({
  amount: z.string().refine((v) => {
    const cents = parsePesos(v)
    return cents !== null && cents > 0
  }, 'Escribe un importe mayor a cero, con hasta 2 decimales (ej. 250 o 250.50)'),
  kind: z.enum(['payment', 'refund']),
  method: z.enum(['cash', 'transfer', 'other']),
  note: z.string().trim().max(500, 'Máximo 500 caracteres'),
})
type Values = z.infer<typeof schema>

// Registro manual de anticipos y pagos. No se capturan datos de tarjeta: la tienda cobra por sus
// propios medios y aquí solo anota el importe recibido.
export function PaymentForm({ orderId }: { orderId: string }) {
  const { exec, busy, error } = useExec()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', kind: 'payment', method: 'transfer', note: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    const ok = await exec(() =>
      addPayment({
        orderId,
        amountCents: parsePesos(values.amount) as number,
        isRefund: values.kind === 'refund',
        method: values.method,
        note: values.note,
      }),
    )
    if (ok) reset()
  })

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate aria-labelledby="pago-titulo">
      <h3 id="pago-titulo" className="mb-1 text-lg font-bold">
        Registrar pago manual
      </h3>
      <p className="mb-3 text-sm text-muted">
        Anota lo que recibiste. Los pagos no se editan ni se borran: para corregir un error, registra un reembolso.
      </p>
      <Field id="amount" label="Importe (MXN)" error={errors.amount?.message}>
        <input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={errors.amount ? true : undefined}
          aria-describedby={describedBy('amount', { error: Boolean(errors.amount) })}
          className={`${inputClass} ${errors.amount ? 'border-danger' : 'border-line'}`}
          {...register('amount')}
        />
      </Field>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field id="kind" label="Tipo">
          <select id="kind" className={`${inputClass} border-line`} {...register('kind')}>
            <option value="payment">Pago o anticipo</option>
            <option value="refund">Reembolso</option>
          </select>
        </Field>
        <Field id="method" label="Método">
          <select id="method" className={`${inputClass} border-line`} {...register('method')}>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="other">Otro</option>
          </select>
        </Field>
      </div>
      <Field id="note" label="Nota (opcional)" error={errors.note?.message}>
        <input id="note" className={`${inputClass} border-line`} {...register('note')} />
      </Field>
      {error && (
        <p role="alert" className="mb-3 text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={`${btnPrimary} disabled:opacity-60`}>
        {busy ? 'Guardando…' : 'Registrar'}
      </button>
    </form>
  )
}
