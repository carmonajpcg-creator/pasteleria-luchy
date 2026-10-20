import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { AuthProvider } from './AuthProvider'

// Raíz de /admin: proporciona la sesión y pide a los buscadores no indexar el panel.
export function AdminRoot() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
