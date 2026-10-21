import { defineConfig, devices } from '@playwright/test'

// Suite E2E contra el proyecto Supabase DE PRUEBAS real (no simulado): `npm run test:live`.
// Requiere LUCHY_ENTORNO=pruebas, SUPABASE_DB_URL (limpieza) y LUCHY_ADMIN_EMAIL/LUCHY_ADMIN_PASSWORD.
// El build toma VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY de .env. Nunca apuntar a producción.
const PORT = 4174

export default defineConfig({
  testDir: './tests/live',
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 90_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: 'real', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite build --outDir dist-live && npx vite preview --outDir dist-live --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
