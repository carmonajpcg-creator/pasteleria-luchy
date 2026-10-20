import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loading, LoadError } from '../../../components/QueryState'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { signOutAdmin } from './signOut'
import { useAdminAccess } from './useAdminAccess'

// Guardia de UX. La seguridad real está en RLS y en las RPC (require_admin), no aquí.
export function RequireAdmin() {
  const access = useAdminAccess()
  const location = useLocation()
  const queryClient = useQueryClient()
  usePageTitle(access.status === 'forbidden' ? 'Sin permisos' : undefined)

  switch (access.status) {
    case 'loading':
      return (
        <main className="mx-auto max-w-xl px-4 py-10">
          <Loading what="el panel" />
        </main>
      )
    case 'anon':
      return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />
    case 'error':
      return (
        <main className="mx-auto max-w-xl px-4 py-10">
          <LoadError what="tu acceso" />
        </main>
      )
    case 'forbidden':
      return (
        <main className="mx-auto max-w-xl px-4 py-10">
          <h1 className="mb-3 text-3xl font-bold">Sin permisos</h1>
          <p className="mb-4">Tu cuenta no tiene acceso al panel de administración.</p>
          <button
            type="button"
            className="min-h-12 rounded-full border-2 border-purple-600 px-6 font-semibold text-purple-700"
            onClick={() => void signOutAdmin(queryClient)}
          >
            Cerrar sesión
          </button>
        </main>
      )
    case 'admin':
      return <Outlet />
  }
}
