const MAX_CENTS = 2_147_483_647 // límite de integer en PostgreSQL

/**
 * «650», «650.5», «$1,250.00» → centavos enteros. Devuelve null si no es un importe válido
 * (negativos, más de 2 decimales, texto). Nunca pasa por punto flotante.
 */
export function parsePesos(input: string): number | null {
  const text = input.trim().replace(/^\$/, '').replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  const [whole = '0', fraction = ''] = text.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null
}

/** Centavos → «650.00» para mostrar en un campo editable. */
export const centsToPesosInput = (cents: number) =>
  `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
