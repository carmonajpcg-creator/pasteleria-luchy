import { createHashRouter, type RouteObject } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { PlaceholderPage } from '../components/PlaceholderPage'

const page = (title: string, phase: string) => <PlaceholderPage title={title} phase={phase} />

// Decisión D2: HashRouter. GitHub Pages es estático: recargas y enlaces directos
// funcionan sin fallback de servidor (https://host/#/catalogo).
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: page('Pastelería Luchy', 'Fase 5') },
      { path: '/catalogo', element: page('Catálogo', 'Fase 5') },
      { path: '/producto/:slug', element: page('Detalle de producto', 'Fase 5') },
      { path: '/carrito', element: page('Carrito', 'Fase 6') },
      { path: '/checkout', element: page('Checkout', 'Fase 6') },
      { path: '/pedido/:folio', element: page('Seguimiento de pedido', 'Fase 6') },
      { path: '/nosotros', element: page('Nosotros', 'Fase 5') },
      { path: '/contacto', element: page('Contacto', 'Fase 5') },
      { path: '/privacidad', element: page('Aviso de privacidad', 'Fase 5') },
      { path: '/condiciones', element: page('Condiciones de pedido', 'Fase 5') },
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
