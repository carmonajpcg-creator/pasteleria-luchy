import type { CatalogProduct } from './types'

// Búsqueda sin distinguir mayúsculas ni acentos («tiramisu» encuentra «tiramisú»).
export const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

export interface CatalogFilters {
  query: string
  category: string
}

export function filterProducts(products: CatalogProduct[], { query, category }: CatalogFilters) {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  return products.filter((p) => {
    if (category && p.category_slug !== category) return false
    if (terms.length === 0) return true
    const haystack = normalize(`${p.name} ${p.description} ${p.category_name}`)
    return terms.every((t) => haystack.includes(t))
  })
}

export function formatLeadTime(hours: number): string | null {
  if (hours <= 0) return null
  if (hours % 24 === 0) {
    const days = hours / 24
    return `${days} ${days === 1 ? 'día' : 'días'}`
  }
  return `${hours} horas`
}
