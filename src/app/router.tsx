import { createHashRouter, type RouteObject } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { PlaceholderPage } from '../components/PlaceholderPage'
import { adminRoutes } from './adminRoutes'
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
      { path: '*', element: page('Página no encontrada', 'Fase 3') },
    ],
  },
  // El panel tiene su propio diseño y sesión; se carga bajo demanda (ver adminRoutes.tsx).
  adminRoutes,
]

export const createRouter = () => createHashRouter(routes)
