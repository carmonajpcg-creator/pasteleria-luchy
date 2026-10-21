/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Política de seguridad de contenido (CSP) por <meta> (GitHub Pages no permite cabeceras HTTP).
 * Solo en el build: el servidor de desarrollo necesita scripts en línea para recargar en caliente.
 * `frame-ancestors` no funciona en <meta>; el panel se protege del clickjacking en AdminRoot.
 */
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : ''
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    `img-src 'self' data: ${supabase}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabase}`.trim(),
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'luchy-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: directives }, injectTo: 'head-prepend' },
    ],
  }
}

// VITE_BASE permite desplegar en GitHub Pages bajo /<repo>/ sin tocar el código.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: process.env.VITE_BASE ?? '/',
    plugins: [react(), tailwindcss(), contentSecurityPolicy(env.VITE_SUPABASE_URL)],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
