import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { adminErrorMessage } from './errors'

/** Refresca datos del panel y los públicos que dependen de ellos (catálogo, configuración). */
export function invalidateAll(queryClient: QueryClient) {
  return Promise.all(
    [['admin'], ['products'], ['product'], ['categories'], ['product-images'], ['store-settings']].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  )
}

/**
 * Ejecuta una acción del panel de una sola vez: un segundo clic mientras la primera sigue en curso se
 * ignora (candado síncrono; el estado de React llega tarde para un doble clic). Muestra el error ya
 * traducido y refresca los datos al terminar.
 */
export function useExec() {
  const queryClient = useQueryClient()
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exec = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      if (busyRef.current) return false
      busyRef.current = true
      setBusy(true)
      setError(null)
      try {
        await action()
        await invalidateAll(queryClient)
        return true
      } catch (e) {
        setError(adminErrorMessage(e))
        return false
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [queryClient],
  )

  return { exec, busy, error, clearError: () => setError(null) }
}
