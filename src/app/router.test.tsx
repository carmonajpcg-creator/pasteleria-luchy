import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { PublicStoreSettings } from '../features/catalog/types'
import { routes } from './router'

// El encabezado lee la configuración pública: se simula para que las pruebas no salgan a la red.
const settings: PublicStoreSettings = {
  store_name: 'Pastelería Luchy', whatsapp_number: null, contact_email: null, contact_phone: null,
  schedule_text: null, coverage_text: null, timezone: 'UTC', demo_notice: null,
}
const fetchStoreSettings = vi.fn(async () => settings)
vi.mock('../features/catalog/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/catalog/api')>()),
  fetchStoreSettings: () => fetchStoreSettings(),
}))

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </QueryClientProvider>,
  )

describe('router', () => {
  it.each([
    // Las pantallas con datos remotos (catálogo, detalle, carrito, checkout, pedido) se cubren en tests/e2e.
    ['/privacidad', 'Aviso de privacidad'],
    ['/condiciones', 'Condiciones de pedido'],
    ['/nosotros', 'Nosotros'],
  ])('muestra %s', (path, heading) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('muestra 404 en rutas desconocidas', () => {
    renderAt('/no-existe')
    expect(screen.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeInTheDocument()
  })

  it('sin aviso configurado no hay banner', async () => {
    renderAt('/nosotros')
    await screen.findByRole('heading', { level: 1, name: 'Nosotros' })
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('con aviso configurado, se muestra en todas las páginas', async () => {
    fetchStoreSettings.mockResolvedValueOnce({ ...settings, demo_notice: 'Sitio en preparación' })
    renderAt('/nosotros')
    expect(await screen.findByText('Sitio en preparación')).toBeInTheDocument()
  })
})
