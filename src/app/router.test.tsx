import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from './router'

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)

describe('router', () => {
  it.each([
    ['/catalogo', 'Catálogo'],
    ['/carrito', 'Carrito'],
    ['/producto/pastel-tres-leches', 'Detalle de producto'],
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
