const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** ¿Contiene `haystack` todos los términos de `query`? Sin distinguir mayúsculas ni acentos. */
export function filterText(query: string, haystack: string): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  const target = normalize(haystack)
  return terms.every((t) => target.includes(t))
}
