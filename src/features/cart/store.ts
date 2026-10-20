import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// Decisión D1: carrito local con Zustand + persist. Solo se guarda lo que el cliente elige
// (producto, cantidad, personalización); los precios se leen del catálogo y los valida el backend.
export interface CartItem {
  productId: string
  quantity: number
  customization?: string
}

export const MAX_QUANTITY = 99
export const MAX_LINES = 30 // mismo tope que create_order
export const MAX_CUSTOMIZATION = 500

const clampQuantity = (n: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.floor(n)))

// El almacenamiento del navegador puede estar manipulado o ser de una versión anterior.
export function sanitizeItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const items: CartItem[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue
    const { productId, quantity, customization } = raw as Record<string, unknown>
    if (typeof productId !== 'string' || productId === '' || seen.has(productId)) continue
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 1) continue
    seen.add(productId)
    items.push({
      productId,
      quantity: clampQuantity(quantity),
      ...(typeof customization === 'string' && customization.trim()
        ? { customization: customization.trim().slice(0, MAX_CUSTOMIZATION) }
        : {}),
    })
    if (items.length === MAX_LINES) break
  }
  return items
}

interface CartState {
  items: CartItem[]
  /** Devuelve false si el carrito ya tiene el máximo de productos distintos. */
  add: (productId: string, quantity: number, customization?: string) => boolean
  setQuantity: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clear: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (productId, quantity, customization) => {
        const note = customization?.trim().slice(0, MAX_CUSTOMIZATION) || undefined
        const existing = get().items.find((i) => i.productId === productId)
        if (!existing && get().items.length >= MAX_LINES) return false
        set((state) => ({
          items: existing
            ? state.items.map((i) =>
                i.productId === productId
                  ? { ...i, quantity: clampQuantity(i.quantity + quantity), customization: note ?? i.customization }
                  : i,
              )
            : [...state.items, { productId, quantity: clampQuantity(quantity), ...(note ? { customization: note } : {}) }],
        }))
        return true
      },
      setQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((i) => (i.productId === productId ? { ...i, quantity: clampQuantity(quantity) } : i)),
        })),
      remove: (productId) => set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'luchy-cart',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      merge: (persisted, current) => ({
        ...current,
        items: sanitizeItems((persisted as { items?: unknown } | undefined)?.items),
      }),
    },
  ),
)

export const selectCount = (state: CartState) => state.items.reduce((sum, i) => sum + i.quantity, 0)
