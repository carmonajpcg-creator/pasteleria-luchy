import { createHashRouter, type RouteObject } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { PlaceholderPage } from '../components/PlaceholderPage'
import { CartPage } from '../features/cart/pages/CartPage'
import { CheckoutPage } from '../features/orders/pages/CheckoutPage'
import { OrderPage } from '../features/orders/pages/OrderPage'
import { CatalogPage } from '../features/catalog/pages/CatalogPage'
import { HomePage } from '../features/catalog/pages/HomePage'
import { ProductPage } from '../features/catalog/pages/ProductPage'
import { AboutPage, ContactPage, PrivacyPage, TermsPage } from '../features/content/StaticPages'

const page = (title: string, phase: string) => <PlaceholderPage title={title} phase={phase} />

// Decisión D2: HashRouter. GitHub Pages es estático: recargas y enlaces directos
// funcionan sin fallback de servidor (https://host/#/catalogo).
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/catalogo', element: <CatalogPage /> },
      { path: '/producto/:slug', element: <ProductPage /> },
      { path: '/carrito', element: <CartPage /> },
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/pedido/:folio', element: <OrderPage /> },
      { path: '/nosotros', element: <AboutPage /> },
      { path: '/contacto', element: <ContactPage /> },
      { path: '/privacidad', element: <PrivacyPage /> },
      { path: '/condiciones', element: <TermsPage /> },
      // Admin: marcadores sin datos. La autenticación real y RLS llegan en Fases 4 y 7.
      { path: '/admin/login', element: page('Acceso administrador', 'Fase 7') },
      { path: '/admin', element: page('Panel administrativo', 'Fase 7') },
      { path: '/admin/productos', element: page('Productos', 'Fase 7') },
      { path: '/admin/categorias', element: page('Categorías', 'Fase 7') },
      { path: '/admin/inventario', element: page('Inventario', 'Fase 7') },
      { path: '/admin/pedidos', element: page('Pedidos', 'Fase 7') },
      { path: '/admin/configuracion', element: page('Configuración', 'Fase 7') },
      { path: '*', element: page('Página no encontrada', 'Fase 3') },
    ],
  },
]

export const createRouter = () => createHashRouter(routes)
