import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter } from './app/router'
import './styles/index.css'

// Un solo reintento: ante una caída de red el aviso de error aparece en ~1 s, no en ~7 s.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })
const router = createRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
