import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { inputClass } from '../../../components/Field'
import { Loading, LoadError } from '../../../components/QueryState'
import { btnOutline } from '../../../components/ui'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { formatDate, toIsoDate } from '../../../lib/dates'
import { formatMXN } from '../../../lib/money'
import { getSalesReport, type SalesReport } from './api'
import { downloadCsv } from './csv'

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toIsoDate(d)
}

const presets = [
  { label: 'Últimos 7 días', range: () => ({ from: daysAgo(6), to: daysAgo(0) }) },
  { label: 'Últimos 30 días', range: () => ({ from: daysAgo(29), to: daysAgo(0) }) },
  {
    label: 'Este mes',
    range: () => {
      const now = new Date()
      return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: daysAgo(0) }
    },
  },
]

const money = (cents: number) => (cents / 100).toFixed(2)

function exportReport(r: SalesReport) {
  downloadCsv(`ventas-${r.from}_a_${r.to}.csv`, [
    ['Reporte de ventas', `${r.from} a ${r.to}`],
    ['Pedidos confirmados', r.orders],
    ['Ventas (MXN)', money(r.sales_cents)],
    ['Pedidos cancelados', r.cancelled],
    ['Pagos netos registrados (MXN)', money(r.paid_cents)],
    [],
    ['Día', 'Pedidos', 'Ventas (MXN)'],
    ...r.by_day.map((d) => [d.day, d.orders, money(d.sales_cents)]),
    [],
    ['SKU', 'Producto', 'Unidades', 'Importe (MXN)'],
    ...r.by_product.map((p) => [p.sku, p.name, p.quantity, money(p.total_cents)]),
  ])
}

export function ReportsPage() {
  usePageTitle('Reporte de ventas')
  const [range, setRange] = useState(() => presets[1]!.range())
  const valid = Boolean(range.from && range.to && range.from <= range.to)

  const report = useQuery({
    queryKey: ['admin', 'sales-report', range.from, range.to],
    queryFn: () => getSalesReport(range.from, range.to),
    enabled: valid,
  })
  const data = report.data

  return (
    <section>
      <h1 className="mb-4 text-3xl font-bold">Reporte de ventas</h1>
      <p className="mb-4 text-muted">
        Cuenta los pedidos por el día en que la tienda los confirmó, sin los cancelados, en la zona horaria de la tienda.
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="font-semibold">
            Desde
          </label>
          <input id="from" type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange({ ...range, from: e.target.value })} className={`${inputClass} border-line`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="font-semibold">
            Hasta
          </label>
          <input id="to" type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} className={`${inputClass} border-line`} />
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Periodos rápidos">
        {presets.map((p) => (
          <button key={p.label} type="button" className={btnOutline} onClick={() => setRange(p.range())}>
            {p.label}
          </button>
        ))}
      </div>

      {!valid && <p role="alert" className="text-danger">Elige un periodo válido: la fecha inicial no puede ser posterior a la final.</p>}
      {valid && report.isPending && <Loading what="el reporte" />}
      {valid && report.isError && <LoadError what="el reporte" onRetry={() => void report.refetch()} />}
      {valid && data && (
        <>
          <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-card bg-white p-4 shadow-card">
              <dt className="text-sm text-muted">Pedidos confirmados</dt>
              <dd className="text-2xl font-bold">{data.orders}</dd>
            </div>
            <div className="rounded-card bg-white p-4 shadow-card">
              <dt className="text-sm text-muted">Ventas</dt>
              <dd className="text-2xl font-bold">{formatMXN(data.sales_cents)}</dd>
            </div>
            <div className="rounded-card bg-white p-4 shadow-card">
              <dt className="text-sm text-muted">Ticket promedio</dt>
              <dd className="text-2xl font-bold">{data.orders ? formatMXN(Math.round(data.sales_cents / data.orders)) : '—'}</dd>
            </div>
            <div className="rounded-card bg-white p-4 shadow-card">
              <dt className="text-sm text-muted">Cancelados</dt>
              <dd className="text-2xl font-bold">{data.cancelled}</dd>
            </div>
            <div className="col-span-2 rounded-card bg-white p-4 shadow-card md:col-span-4">
              <dt className="text-sm text-muted">Pagos registrados en el periodo (neto de reembolsos)</dt>
              <dd className="text-2xl font-bold">{formatMXN(data.paid_cents)}</dd>
            </div>
          </dl>

          <p className="mb-6">
            <button type="button" className={btnOutline} onClick={() => exportReport(data)}>
              Descargar CSV
            </button>
          </p>

          <h2 className="mb-2 text-xl font-bold">Por día</h2>
          {data.by_day.length === 0 ? (
            <p className="mb-6 text-muted">Sin ventas confirmadas en este periodo.</p>
          ) : (
            <div className="mb-6 overflow-x-auto rounded-card bg-white shadow-card">
              <table className="w-full text-left">
                <caption className="sr-only">Ventas por día</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="p-3">Día</th>
                    <th scope="col" className="p-3 text-right">Pedidos</th>
                    <th scope="col" className="p-3 text-right">Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_day.map((d) => (
                    <tr key={d.day} className="border-b border-line last:border-0">
                      <th scope="row" className="p-3 font-normal">{formatDate(d.day)}</th>
                      <td className="p-3 text-right">{d.orders}</td>
                      <td className="p-3 text-right">{formatMXN(d.sales_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="mb-2 text-xl font-bold">Productos más vendidos</h2>
          {data.by_product.length === 0 ? (
            <p className="text-muted">Sin productos vendidos en este periodo.</p>
          ) : (
            <div className="overflow-x-auto rounded-card bg-white shadow-card">
              <table className="w-full text-left">
                <caption className="sr-only">Productos vendidos en el periodo</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="p-3">Producto</th>
                    <th scope="col" className="p-3 text-right">Unidades</th>
                    <th scope="col" className="p-3 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_product.map((p) => (
                    <tr key={p.sku} className="border-b border-line last:border-0">
                      <th scope="row" className="p-3 font-normal">
                        {p.name} <span className="text-sm text-muted">({p.sku})</span>
                      </th>
                      <td className="p-3 text-right">{p.quantity}</td>
                      <td className="p-3 text-right">{formatMXN(p.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
