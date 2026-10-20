const pad = (n: number) => String(n).padStart(2, '0')

/** Date → «YYYY-MM-DD» con la fecha local (el valor de <input type="date">). */
export const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** «YYYY-MM-DD» → Date a medianoche local, sin desfase por zona horaria. */
export function parseIsoDate(iso: string): Date {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** «YYYY-MM-DD» → «25 de octubre de 2026». */
export const formatDate = (iso: string) =>
  parseIsoDate(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
