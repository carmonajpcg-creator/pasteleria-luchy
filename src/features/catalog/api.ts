import { supabase } from '../../lib/supabase'
import type { CatalogProduct, Category, ProductImage, PublicStoreSettings } from './types'

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  return supabase
}

export async function fetchProducts(): Promise<CatalogProduct[]> {
  const { data, error } = await client().from('catalog_products').select('*').order('name')
  if (error) throw error
  return data as CatalogProduct[]
}

export async function fetchProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const { data, error } = await client().from('catalog_products').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data as CatalogProduct | null
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await client()
    .from('categories')
    .select('id, slug, name, sort_order')
    .order('sort_order')
  if (error) throw error
  return data as Category[]
}

export async function fetchProductImages(): Promise<ProductImage[]> {
  const { data, error } = await client()
    .from('product_images')
    .select('product_id, storage_path, alt, sort_order, is_demo')
    .order('sort_order')
  if (error) throw error
  return data as ProductImage[]
}

export function productImageUrl(storagePath: string): string {
  return client().storage.from('product-images').getPublicUrl(storagePath).data.publicUrl
}

export async function fetchStoreSettings(): Promise<PublicStoreSettings> {
  const { data, error } = await client()
    .from('store_settings')
    .select('store_name, whatsapp_number, contact_email, contact_phone, schedule_text, coverage_text')
    .single()
  if (error) throw error
  return data as PublicStoreSettings
}
