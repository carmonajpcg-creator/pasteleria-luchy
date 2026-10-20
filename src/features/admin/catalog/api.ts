import { db, unwrap } from '../lib/client'
import { imageStoragePath } from '../lib/image'

export interface AdminCategory {
  id: string
  slug: string
  name: string
  sort_order: number
  active: boolean
}

export interface AdminProduct {
  id: string
  category_id: string
  sku: string
  slug: string
  name: string
  description: string
  price_cents: number
  allergens: string[]
  allergens_verified: boolean
  lead_time_hours: number
  fulfillment_type: 'stock' | 'made_to_order'
  stock_quantity: number
  low_stock_threshold: number
  featured: boolean
  active: boolean
}

export interface AdminImage {
  id: string
  product_id: string
  storage_path: string
  alt: string
  sort_order: number
  is_demo: boolean
}

const CATEGORY = 'id, slug, name, sort_order, active'
const PRODUCT =
  'id, category_id, sku, slug, name, description, price_cents, allergens, allergens_verified, lead_time_hours, fulfillment_type, stock_quantity, low_stock_threshold, featured, active'

export const listCategories = () =>
  unwrap<AdminCategory[]>(db().from('categories').select(CATEGORY).order('sort_order').order('name'))

export type CategoryInput = Omit<AdminCategory, 'id'>

export async function saveCategory(id: string | null, input: CategoryInput): Promise<void> {
  const q = id ? db().from('categories').update(input).eq('id', id) : db().from('categories').insert(input)
  const { error } = await q
  if (error) throw error
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await db().from('categories').delete().eq('id', id)
  if (error) throw error
}

export const listProducts = () => unwrap<AdminProduct[]>(db().from('products').select(PRODUCT).order('name'))

export async function getProduct(id: string): Promise<AdminProduct | null> {
  const { data, error } = await db().from('products').select(PRODUCT).eq('id', id).maybeSingle()
  if (error) throw error
  return data as AdminProduct | null
}

// stock_quantity no forma parte de lo editable: solo cambia con adjust_stock (movimiento auditado).
export type ProductInput = Omit<AdminProduct, 'id' | 'stock_quantity'>

export async function saveProduct(id: string | null, input: ProductInput): Promise<string> {
  if (id) {
    const { error } = await db().from('products').update(input).eq('id', id)
    if (error) throw error
    return id
  }
  const { data, error } = await db().from('products').insert(input).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

export const listProductImages = (productId: string) =>
  unwrap<AdminImage[]>(
    db()
      .from('product_images')
      .select('id, product_id, storage_path, alt, sort_order, is_demo')
      .eq('product_id', productId)
      .order('sort_order'),
  )

export async function uploadProductImage(productId: string, file: File, alt: string, nextOrder: number): Promise<void> {
  const path = imageStoragePath(productId, file.type)
  const bucket = db().storage.from('product-images')
  const { error: uploadError } = await bucket.upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError
  const { error } = await db()
    .from('product_images')
    .insert({ product_id: productId, storage_path: path, alt: alt.trim(), sort_order: nextOrder, is_demo: true })
  if (error) {
    // No dejar un archivo huérfano si falló el registro.
    await bucket.remove([path])
    throw error
  }
}

export async function updateProductImage(id: string, patch: { alt: string; is_demo: boolean }): Promise<void> {
  const { error } = await db().from('product_images').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteProductImage(image: AdminImage): Promise<void> {
  const { error } = await db().from('product_images').delete().eq('id', image.id)
  if (error) throw error
  await db().storage.from('product-images').remove([image.storage_path])
}
