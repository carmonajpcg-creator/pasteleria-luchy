// Los importes viajan en centavos enteros (MXN); solo se formatean para mostrarlos.
const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export const formatMXN = (cents: number) => `${formatter.format(cents / 100)} MXN`
