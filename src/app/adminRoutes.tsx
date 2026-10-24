import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router-dom'
import { Loading } from '../components/QueryState'

// Cada pantalla del panel se descarga solo al visitarla: el sitio público no carga nada de /admin.
const lazyPage = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => ({
  lazy: async () => ({ Component: (await load())[name] }),
})

export const adminRoutes: RouteObject = {
  path: '/admin',
  ...lazyPage(() => import('../features/admin/auth/AdminRoot'), 'AdminRoot'),
  HydrateFallback: () => (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Loading what="el panel" />
    </main>
  ),
  children: [
    { path: 'login', ...lazyPage(() => import('../features/admin/auth/LoginPage'), 'LoginPage') },
    { path: 'recuperar', ...lazyPage(() => import('../features/admin/auth/ForgotPasswordPage'), 'ForgotPasswordPage') },
    { path: 'restablecer', ...lazyPage(() => import('../features/admin/auth/ResetPasswordPage'), 'ResetPasswordPage') },
    {
      ...lazyPage(() => import('../features/admin/auth/RequireAdmin'), 'RequireAdmin'),
      children: [
        {
          ...lazyPage(() => import('../features/admin/layout/AdminLayout'), 'AdminLayout'),
          children: [
            { index: true, ...lazyPage(() => import('../features/admin/dashboard/DashboardPage'), 'DashboardPage') },
            { path: 'pedidos', ...lazyPage(() => import('../features/admin/orders/pages/OrdersPage'), 'OrdersPage') },
            { path: 'pedidos/:id', ...lazyPage(() => import('../features/admin/orders/pages/OrderDetailPage'), 'OrderDetailPage') },
            { path: 'productos', ...lazyPage(() => import('../features/admin/catalog/pages/ProductsPage'), 'ProductsPage') },
            { path: 'productos/nuevo', ...lazyPage(() => import('../features/admin/catalog/pages/ProductFormPage'), 'ProductFormPage') },
            { path: 'productos/:id', ...lazyPage(() => import('../features/admin/catalog/pages/ProductFormPage'), 'ProductFormPage') },
            { path: 'reportes', ...lazyPage(() => import('../features/admin/reports/ReportsPage'), 'ReportsPage') },
            { path: 'categorias', ...lazyPage(() => import('../features/admin/catalog/pages/CategoriesPage'), 'CategoriesPage') },
            { path: 'inventario', ...lazyPage(() => import('../features/admin/inventory/pages/InventoryPage'), 'InventoryPage') },
            { path: 'configuracion', ...lazyPage(() => import('../features/admin/settings/pages/SettingsPage'), 'SettingsPage') },
          ],
        },
      ],
    },
  ],
}
