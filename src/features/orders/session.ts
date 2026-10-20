// Estado efímero del navegador (sessionStorage) para el flujo de pedido. Cualquier acceso puede
// fallar (modo privado, almacenamiento bloqueado): la app debe funcionar sin él.

const ATTEMPT_KEY = 'luchy-order-attempt'
const extrasKey = (folio: string) => `luchy-order-extras:${folio}`

let memoryAttempt: { fingerprint: string; key: string } | null = null

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sin almacenamiento: se usa solo memoria */
  }
}

// Solo se guarda un SHA-256 del contenido, nunca nombre, teléfono o notas en claro.
async function sha256(text: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Clave de idempotencia estable mientras no cambie el contenido del pedido: un reintento tras un
 * fallo de red o un doble clic reutiliza la clave y no duplica el pedido. Si el carrito o los datos
 * cambian, se genera otra, para no devolver un pedido con contenido distinto.
 */
export async function attemptKey(content: unknown): Promise<string> {
  const text = JSON.stringify(content)
  const hash = await sha256(text)
  // Sin WebCrypto (contexto no seguro) la huella solo vive en memoria.
  const fingerprint = hash ?? text
  const stored = memoryAttempt ?? read<{ fingerprint: string; key: string }>(ATTEMPT_KEY)
  if (stored && stored.fingerprint === fingerprint) return stored.key
  const next = { fingerprint, key: crypto.randomUUID() }
  memoryAttempt = next
  if (hash) write(ATTEMPT_KEY, next)
  return next.key
}

export function clearAttempt() {
  memoryAttempt = null
  try {
    sessionStorage.removeItem(ATTEMPT_KEY)
  } catch {
    /* nada que limpiar */
  }
}

// Datos que get_order_public no devuelve (nombre, notas, personalización) y que el mensaje de
// WhatsApp sí incluye. Solo viven en esta pestaña.
export interface OrderExtras {
  customerName: string
  notes: string
  customizations: Record<string, string> // por nombre de producto
}

export const saveExtras = (folio: string, extras: OrderExtras) => write(extrasKey(folio), extras)
export const loadExtras = (folio: string) => read<OrderExtras>(extrasKey(folio))
