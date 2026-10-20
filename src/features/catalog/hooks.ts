import { useQuery } from '@tanstack/react-query'
import {
  fetchCategories,
  fetchProductBySlug,
  fetchProductImages,
  fetchProducts,
  fetchStoreSettings,
} from './api'

const staleTime = 5 * 60 * 1000

export const useProducts = () => useQuery({ queryKey: ['products'], queryFn: fetchProducts, staleTime })
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime })
export const useProductImages = () =>
  useQuery({ queryKey: ['product-images'], queryFn: fetchProductImages, staleTime })
export const useStoreSettings = () =>
  useQuery({ queryKey: ['store-settings'], queryFn: fetchStoreSettings, staleTime })
export const useProduct = (slug: string | undefined) =>
  useQuery({
    queryKey: ['product', slug],
    queryFn: () => fetchProductBySlug(slug as string),
    enabled: Boolean(slug),
    staleTime,
  })
