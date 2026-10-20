import { useQuery } from '@tanstack/react-query'
import { db } from '../lib/client'
import { useAuth } from './AuthProvider'

export type AdminAccess =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'forbidden' }
  | { status: 'error' }
  | { status: 'admin'; email: string }

// El rol se lee de public.profiles (RLS: cada usuario solo ve su fila, el admin ve todas). Esto es
// solo para decidir qué pantalla mostrar: cada operación la vuelve a autorizar la base de datos.
export function useAdminAccess(): AdminAccess {
  const auth = useAuth()
  const userId = auth.user?.id
  const role = useQuery({
    queryKey: ['admin', 'role', userId],
    enabled: auth.status === 'authed' && Boolean(userId),
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await db().from('profiles').select('role').eq('user_id', userId as string).maybeSingle()
      if (error) throw error
      return (data as { role: string } | null)?.role ?? null
    },
  })

  if (auth.status === 'loading') return { status: 'loading' }
  if (auth.status === 'anon') return { status: 'anon' }
  if (role.isPending) return { status: 'loading' }
  if (role.isError) return { status: 'error' }
  return role.data === 'admin' ? { status: 'admin', email: auth.user?.email ?? '' } : { status: 'forbidden' }
}
