import { z } from 'zod'
import { parsePesos } from '../lib/pesos'
import { SLUG_PATTERN } from '../lib/slugify'
import type { CategoryInput, ProductInput } from './api'

const slug = z.string().trim().regex(SLUG_PATTERN, 'Usa solo minúsculas, números y guiones (ej. pastel-de-fresa)')

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre').max(80, 'Máximo 80 caracteres'),
  slug,
  sortOrder: z.string().regex(/^-?\d{1,6}$/, 'Escribe un número entero'),
  active: z.boolean(),
})
export type CategoryValues = z.infer<typeof categorySchema>

export const toCategoryInput = (v: CategoryValues): CategoryInput => ({
  name: v.name.trim(),
  slug: v.slug.trim(),
  sort_order: Number(v.sortOrder),
  active: v.active,
})

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre').max(120, 'Máximo 120 caracteres'),
  slug,
  sku: z.string().trim().min(1, 'Escribe el SKU').max(40, 'Máximo 40 caracteres'),
  description: z.string().trim().max(2000, 'Máximo 2000 caracteres'),
  categoryId: z.string().min(1, 'Elige una categoría'),
  price: z.string().refine((v) => parsePesos(v) !== null, 'Escribe un precio válido, con hasta 2 decimales (ej. 650 o 650.50)'),
  fulfillmentType: z.enum(['stock', 'made_to_order']),
  leadTimeHours: z.string().regex(/^\d{1,3}$/, 'Escribe horas enteras (0 a 999)'),
  lowStockThreshold: z.string().regex(/^\d{1,4}$/, 'Escribe un número entero (0 o más)'),
  allergens: z.string().max(300, 'Máximo 300 caracteres'),
  allergensVerified: z.boolean(),
  featured: z.boolean(),
  active: z.boolean(),
  allowsCustomization: z.boolean(),
  customizationHint: z.string().trim().max(120, 'Máximo 120 caracteres'),
})
export type ProductValues = z.infer<typeof productSchema>

export const parseAllergens = (text: string) =>
  [...new Set(text.split(/[,;\n]/).map((a) => a.trim()).filter(Boolean))]

export const toProductInput = (v: ProductValues): ProductInput => ({
  name: v.name.trim(),
  slug: v.slug.trim(),
  sku: v.sku.trim(),
  description: v.description.trim(),
  category_id: v.categoryId,
  price_cents: parsePesos(v.price) as number,
  fulfillment_type: v.fulfillmentType,
  lead_time_hours: Number(v.leadTimeHours),
  low_stock_threshold: Number(v.lowStockThreshold),
  allergens: parseAllergens(v.allergens),
  // «Verificado» con lista vacía significa que la tienda confirmó que no declara alérgenos.
  allergens_verified: v.allergensVerified,
  featured: v.featured,
  active: v.active,
  allows_customization: v.allowsCustomization,
  // La pista solo tiene sentido si el producto admite personalización.
  customization_hint: v.allowsCustomization ? v.customizationHint.trim() || null : null,
})
