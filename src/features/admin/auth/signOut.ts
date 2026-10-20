import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'

/** Cierra la sesión y descarta todo dato administrativo que haya quedado en caché. */
export async function signOutAdmin(queryClient: QueryClient) {
  await supabase?.auth.signOut()
  queryClient.removeQueries({ queryKey: ['admin'] })
}
