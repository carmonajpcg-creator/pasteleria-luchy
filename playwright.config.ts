import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: './tests',
  // tests/live usa el backend real de pruebas y tiene su propia configuración (playwright.live.config.ts).
  testIgnore: ['**/live/**', '**/smoke/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  // Se prueba el build de producción (igual que GitHub Pages), no el servidor de desarrollo.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // El build de pruebas apunta a un host ficticio: las respuestas se simulan en
    // tests/e2e/helpers.ts, así que nunca se consulta el proyecto real de Supabase.
    env: {
      VITE_SUPABASE_URL: 'http://supabase.test',
      VITE_SUPABASE_ANON_KEY: 'clave-publica-de-prueba',
    },
  },
})
