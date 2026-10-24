import { useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet } from 'react-router-dom'
import { signOutAdmin } from '../auth/signOut'
import { useAdminAccess } from '../auth/useAdminAccess'
import { useOrderAlerts } from '../orders/useOrderAlerts'

const links = [
  { to: '/admin', label: 'Panel', end: true },
  { to: '/admin/pedidos', label: 'Pedidos', end: false },
  { to: '/admin/productos', label: 'Productos', end: false },
  { to: '/admin/categorias', label: 'Categorías', end: false },
  { to: '/admin/inventario', label: 'Inventario', end: false },
  { to: '/admin/reportes', label: 'Reportes', end: false },
  { to: '/admin/configuracion', label: 'Configuración', end: false },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-12 items-center whitespace-nowrap rounded-full px-3 no-underline ${
    isActive ? 'bg-purple-100 font-semibold text-purple-700' : 'text-ink'
  }`

export function AdminLayout() {
  const access = useAdminAccess()
  const queryClient = useQueryClient()
  const alerts = useOrderAlerts()

  return (
    <>
      <a href="#contenido" className="absolute -top-16 left-2 z-10 bg-white px-3 py-2 focus:top-2">
        Saltar al contenido
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <p className="font-heading text-lg font-bold text-purple-700">Panel · Pastelería Luchy</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {access.status === 'admin' && <span className="text-muted">{access.email}</span>}
            <button
              type="button"
              aria-pressed={alerts.enabled}
              className="min-h-12 font-semibold text-purple-700 underline"
              onClick={() => void alerts.toggle()}
            >
              {alerts.enabled ? 'Avisos de pedidos: activados' : 'Activar avisos de pedidos'}
            </button>
            <NavLink to="/" className="font-semibold text-purple-700 underline">
              Ver tienda
            </NavLink>
            <button
              type="button"
              className="min-h-12 font-semibold text-purple-700 underline"
              onClick={() => void signOutAdmin(queryClient)}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
        <nav aria-label="Administración" className="mx-auto flex max-w-6xl flex-wrap gap-0.5 px-4 pb-2">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
              {l.to === '/admin/pedidos' && alerts.pending > 0 && (
                <span className="ml-2 rounded-full bg-purple-700 px-2 text-sm font-bold text-white">
                  {alerts.pending}
                  <span className="sr-only"> pedidos pendientes de contacto</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </>
  )
}
