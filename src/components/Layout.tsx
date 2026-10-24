import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { selectCount, useCart } from '../features/cart/store'
import { useStoreSettings } from '../features/catalog/hooks'
import { useHasSession } from '../hooks/useHasSession'
import { Icon } from './Icon'

const links = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/catalogo', label: 'Catálogo', end: false },
  { to: '/nosotros', label: 'Nosotros', end: false },
  { to: '/contacto', label: 'Contacto', end: false },
]
const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' is-active' : ''}`

export function Layout() {
  const count = useCart(selectCount)
  const hasSession = useHasSession()
  const settings = useStoreSettings()
  const location = useLocation()
  const notice = settings.data?.demo_notice

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  return (
    <div className="site-shell">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      {notice && <p role="note" className="store-notice">{notice}</p>}
      <header className="site-header">
        <div className="page-frame header-inner">
          <NavLink to="/" className="wordmark" aria-label="Pastelería Luchy">
            <span className="wordmark-name">Luchy<span aria-hidden="true">.</span></span>
            <span className="wordmark-description">Pastelería</span>
          </NavLink>
          <nav aria-label="Principal" className="header-nav">
            <div className="nav-pages">{links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>)}</div>
            <div className="nav-actions">
              <NavLink to={hasSession ? '/admin/pedidos' : '/admin/login'} className="account-link" aria-label={hasSession ? 'Consola de pedidos' : 'Iniciar sesión'}>
                <Icon name="user" /><span className="account-label">{hasSession ? 'Mis pedidos' : 'Iniciar sesión'}</span>
              </NavLink>
              <NavLink to="/carrito" className="cart-link" aria-label={count > 0 ? `Carrito, ${count} ${count === 1 ? 'producto' : 'productos'}` : 'Carrito'}>
                <Icon name="bag" /><span>Carrito</span><span className="cart-count" aria-hidden="true">{count}</span>
              </NavLink>
            </div>
          </nav>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="page-frame site-main"><Outlet /></main>
      <footer className="site-footer">
        <div className="page-frame">
          <div className="footer-top">
            <div className="footer-brand"><p className="footer-wordmark">Luchy.</p><p>Un buen momento empieza<br />con algo dulce.</p></div>
            <div><h2>Nos vemos por aquí</h2><NavLink to="/catalogo">Explorar el catálogo</NavLink><NavLink to="/nosotros">Conoce Luchy</NavLink><NavLink to="/contacto">Contacto y entregas</NavLink></div>
            <div><h2>Planea tu pedido</h2><p>{settings.data?.schedule_text ? `Horarios: ${settings.data.schedule_text}` : 'Horarios y cobertura: por definir.'}</p><p>Elige en la web y confirma<br />con la tienda por WhatsApp.</p></div>
          </div>
          <div className="footer-bottom"><p>Pastelería Luchy · Hecho para compartir</p><div><NavLink to="/privacidad">Privacidad</NavLink><NavLink to="/condiciones">Condiciones</NavLink></div></div>
        </div>
      </footer>
    </div>
  )
}
