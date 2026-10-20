import { formatLeadTime, filterProducts, normalize } from './filter'
import type { CatalogProduct } from './types'

const make = (over: Partial<CatalogProduct>): CatalogProduct => ({
  id: 'x', slug: 'x', sku: 'X', name: 'X', description: '', price_cents: 100, allergens: [],
  allergens_verified: false, lead_time_hours: 0, fulfillment_type: 'stock', featured: false,
  available: true, category_id: 'c', category_slug: 'pasteles', category_name: 'Pasteles', ...over,
})

const products = [
  make({ id: '1', name: 'Mini tiramisú', category_slug: 'postres', category_name: 'Postres' }),
  make({ id: '2', name: 'Pastel de chocolate fudge', description: 'Con cobertura fudge' }),
  make({ id: '3', name: 'Cupcake de vainilla', category_slug: 'cupcakes', category_name: 'Cupcakes' }),
]

describe('normalize', () => {
  it('quita acentos y mayúsculas', () => {
    expect(normalize('  TiramisÚ ')).toBe('tiramisu')
  })
})

describe('filterProducts', () => {
  it('sin filtros devuelve todo', () => {
    expect(filterProducts(products, { query: '', category: '' })).toHaveLength(3)
  })
  it('busca sin acentos', () => {
    expect(filterProducts(products, { query: 'tiramisu', category: '' }).map((p) => p.id)).toEqual(['1'])
  })
  it('exige todos los términos', () => {
    expect(filterProducts(products, { query: 'pastel fudge', category: '' }).map((p) => p.id)).toEqual(['2'])
    expect(filterProducts(products, { query: 'pastel vainilla', category: '' })).toHaveLength(0)
  })
  it('busca también en la descripción y la categoría', () => {
    expect(filterProducts(products, { query: 'cobertura', category: '' })).toHaveLength(1)
    expect(filterProducts(products, { query: 'cupcakes', category: '' })).toHaveLength(1)
  })
  it('filtra por categoría y combina con búsqueda', () => {
    expect(filterProducts(products, { query: '', category: 'cupcakes' }).map((p) => p.id)).toEqual(['3'])
    expect(filterProducts(products, { query: 'fudge', category: 'cupcakes' })).toHaveLength(0)
  })
})

describe('formatLeadTime', () => {
  it.each([
    [0, null],
    [24, '1 día'],
    [48, '2 días'],
    [36, '36 horas'],
  ])('%i h → %s', (hours, expected) => {
    expect(formatLeadTime(hours)).toBe(expected)
  })
})
