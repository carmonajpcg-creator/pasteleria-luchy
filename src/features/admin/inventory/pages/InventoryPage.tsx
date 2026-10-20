import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Field, inputClass } from '../../../../components/Field'
import { Loading, LoadError } from '../../../../components/QueryState'
import { btnPrimary } from '../../../../components/ui'
import { usePageTitle } from '../../../../hooks/usePageTitle'
import { useExec } from '../../lib/useExec'
import {
  adjustStock,
  countMadeToOrder,
  listMovements,
  listStock,
  reasonLabel,
  signedDelta,
  type ManualReason,
  type StockRow,
} from '../api'

const dateTime = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

function AdjustPanel({ product, onClose }: { product: StockRow; onClose: () => void }) {
  const { exec, busy, error } = useExec()
  const [reason, setReason] = useState<ManualReason>('production')
  const [direction, setDirection] = useState<'add' | 'subtract'>('add')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [invalid, setInvalid] = useState(false)
  const history = useQuery({ queryKey: ['admin', 'movements', product.id], queryFn: () => listMovements(product.id) })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const delta = signedDelta(reason, direction, amount)
    setInvalid(delta === null)
    if (delta === null) return
    if (await exec(() => adjustStock(product.id, delta, reason, note))) {
      setAmount('')
      setNote('')
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-line p-4">
      <h3 className="mb-3 text-lg font-bold">Ajustar inventario: {product.name}</h3>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="grid gap-x-3 sm:grid-cols-3">
          <Field id="reason" label="Motivo">
            <select id="reason" value={reason} onChange={(e) => setReason(e.target.value as ManualReason)} className={`${inputClass} border-line`}>
              <option value="production">Producción (suma)</option>
              <option value="purchase">Compra (suma)</option>
              <option value="waste">Merma (resta)</option>
              <option value="adjustment">Ajuste manual</option>
            </select>
          </Field>
          {reason === 'adjustment' && (
            <Field id="direction" label="Dirección">
              <select id="direction" value={direction} onChange={(e) => setDirection(e.target.value as 'add' | 'subtract')} className={`${inputClass} border-line`}>
                <option value="add">Sumar</option>
                <option value="subtract">Restar</option>
              </select>
            </Field>
          )}
          <Field id="amount" label="Cantidad" error={invalid ? 'Escribe un número entero mayor a cero' : undefined}>
            <input
              id="amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={invalid ? true : undefined}
              aria-describedby={invalid ? 'amount-error' : undefined}
              className={`${inputClass} ${invalid ? 'border-danger' : 'border-line'}`}
            />
          </Field>
        </div>
        <Field id="adj-note" label="Nota (opcional)">
          <input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={`${inputClass} border-line`} />
        </Field>
        {error && (
          <p role="alert" className="mb-3 text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className={`${btnPrimary} disabled:opacity-60`}>
            {busy ? 'Guardando…' : 'Registrar movimiento'}
          </button>
          <button type="button" className="min-h-12 font-semibold underline" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </form>

      <h4 className="mb-1 mt-4 font-bold">Historial reciente</h4>
      {history.isPending && <Loading what="el historial" />}
      {history.isError && <LoadError what="el historial" />}
      {history.data &&
        (history.data.length === 0 ? (
          <p className="text-muted">Sin movimientos.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.data.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 py-2">
                <span>
                  {reasonLabel[m.reason] ?? m.reason}
                  {m.note && <span className="text-muted"> · {m.note}</span>}
                  <span className="block text-sm text-muted">{dateTime(m.created_at)}</span>
                </span>
                <span className="font-semibold">{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}

export function InventoryPage() {
  usePageTitle('Inventario')
  const stock = useQuery({ queryKey: ['admin', 'inventory'], queryFn: listStock })
  const madeToOrder = useQuery({ queryKey: ['admin', 'made-to-order-count'], queryFn: countMadeToOrder })
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <section>
      <h1 className="mb-1 text-3xl font-bold">Inventario</h1>
      <p className="mb-4 text-muted">
        Productos terminados con existencia física. Cada cambio queda registrado como movimiento y no se puede borrar.
        {madeToOrder.data ? ` ${madeToOrder.data} productos «bajo pedido» no llevan inventario.` : ''}
      </p>

      {stock.isPending && <Loading what="el inventario" />}
      {stock.isError && <LoadError what="el inventario" onRetry={() => void stock.refetch()} />}
      {stock.data && (
        <ul className="grid gap-3">
          {stock.data.map((p) => {
            const low = p.stock_quantity <= p.low_stock_threshold
            return (
              <li key={p.id} className="rounded-card bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {p.name} <span className="text-sm font-normal text-muted">({p.sku})</span>
                    </p>
                    <p className={low ? 'font-semibold text-danger' : 'text-muted'}>
                      {p.stock_quantity} en existencia{low ? ' · stock bajo' : ''} · aviso en {p.low_stock_threshold}
                      {!p.active && ' · inactivo'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="min-h-12 font-semibold text-purple-700 underline"
                    aria-expanded={openId === p.id}
                    aria-label={`${openId === p.id ? 'Cerrar ajuste de' : 'Ajustar'} ${p.name}`}
                    onClick={() => setOpenId(openId === p.id ? null : p.id)}
                  >
                    {openId === p.id ? 'Cerrar' : 'Ajustar'}
                  </button>
                </div>
                {openId === p.id && <AdjustPanel product={p} onClose={() => setOpenId(null)} />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
