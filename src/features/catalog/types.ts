// Forma de las filas públicas (vista catalog_products y tablas de lectura anónima).
export type FulfillmentType = 'stock' | 'made_to_order'

export interface CatalogProduct {
  id: string
  slug: string
  sku: string
  name: string
  description: string
  price_cents: number
  allergens: string[]
  allergens_verified: boolean
  lead_time_hours: number
  fulfillment_type: FulfillmentType
  featured: boolean
  available: boolean
  category_id: string
  category_slug: string
  category_name: string
}

export interface Category {
  id: string
  slug: string
  name: string
  sort_order: number
}

export interface ProductImage {
  product_id: string
  storage_path: string
  alt: string
  sort_order: number
  is_demo: boolean
}

export interface PublicStoreSettings {
  store_name: string
  whatsapp_number: string | null
  contact_email: string | null
  contact_phone: string | null
  schedule_text: string | null
  coverage_text: string | null
}
