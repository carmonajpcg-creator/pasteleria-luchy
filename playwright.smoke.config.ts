import { defineConfig, devices } from '@playwright/test'

// Pruebas de humo SOLO DE LECTURA contra una URL ya publicada (CLAUDE.md §11, Fase 10):
//   SMOKE_URL=https://usuario.github.io/pasteleria-luchy/ npm run test:smoke
// No crean pedidos ni escriben datos: la producción real nunca recibe datos de prueba.
const url = process.env.SMOKE_URL
if (!url) throw new Error('Define SMOKE_URL con la URL publicada (termina en /).')

export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: true,
  retries: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: url.endsWith('/') ? url : `${url}/`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
})
