/** «Pastel de tres leches» → «pastel-de-tres-leches» (mismo formato que exige la BD). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
