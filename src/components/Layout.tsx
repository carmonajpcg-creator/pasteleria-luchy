import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/catalogo', label: 'Catálogo', end: false },
  { to: '/carrito', label: 'Carrito', end: false },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-12 items-center whitespace-nowrap rounded-full px-3 no-underline ${
    isActive ? 'bg-purple-100 font-semibold text-purple-700' : 'text-ink'
  }`

export function Layout() {
  return (
    <>
      <a
        href="#contenido"
        className="absolute -top-16 left-2 z-10 bg-white px-3 py-2 focus:top-2"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-5 border-b border-line bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-1">
          <NavLink to="/" className="whitespace-nowrap font-heading text-xl font-bold text-purple-700 no-underline">
            Pastelería Luchy
          </NavLink>
          <nav aria-label="Principal" className="flex gap-0.5">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mt-12 bg-ink py-8 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <p>
            Horarios y cobertura: por definir. ·{' '}
            <NavLink to="/nosotros" className="text-green-300 underline">Nosotros</NavLink> ·{' '}
            <NavLink to="/contacto" className="text-green-300 underline">Contacto</NavLink> ·{' '}
            <NavLink to="/privacidad" className="text-green-300 underline">Privacidad</NavLink> ·{' '}
            <NavLink to="/condiciones" className="text-green-300 underline">Condiciones</NavLink>
          </p>
        </div>
      </footer>
    </>
  )
}
