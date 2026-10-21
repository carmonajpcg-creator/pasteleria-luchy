import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { AuthProvider } from './AuthProvider'

// El panel no se muestra dentro de otra página (clickjacking). GitHub Pages no permite la cabecera
// frame-ancestors y la CSP por <meta> la ignora, así que se comprueba aquí.
const framed = (() => {
  try {
    return window.top !== window.self
  } catch {
    return true // el navegador no deja leer window.top: está en un marco de otro origen
  }
})()

// Raíz de /admin: proporciona la sesión y pide a los buscadores no indexar el panel.
export function AdminRoot() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  if (framed) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold">Acceso bloqueado</h1>
        <p>Por seguridad, el panel de administración no puede mostrarse dentro de otra página.</p>
      </main>
    )
  }

  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
