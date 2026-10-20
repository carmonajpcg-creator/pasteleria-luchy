import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from './router'

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)

describe('router', () => {
  it.each([
    // Las pantallas con datos remotos (catálogo, detalle, carrito, checkout, pedido) se cubren en tests/e2e.
    ['/privacidad', 'Aviso de privacidad'],
    ['/condiciones', 'Condiciones de pedido'],
    ['/nosotros', 'Nosotros'],
    ['/admin/pedidos', 'Pedidos'],
  ])('muestra %s', (path, heading) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('muestra 404 en rutas desconocidas', () => {
    renderAt('/no-existe')
    expect(screen.getByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeInTheDocument()
  })
})
