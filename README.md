# Pastelería Luchy

Tienda web de repostería (español MX, MXN) con catálogo, carrito y pedido por WhatsApp. Nombre provisional.

## Estado

**Fase 3 — Configuración técnica** (Fases 1 y 2 completadas). La app arranca con rutas y diseño base; las pantallas son marcadores de posición hasta las Fases 5–7. Aún no hay backend (Fase 4).

## Requisitos

Node.js 24 LTS y Git.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias |
| `npm run dev` | Servidor de desarrollo (http://localhost:5173) |
| `npm run build` | Typecheck + build de producción en `dist/` |
| `npm run preview` | Sirve el build |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript estricto |
| `npm test` | Vitest (unitarias/componentes) |
| `npm run test:e2e` | Playwright (construye y prueba el build; Chromium desktop + móvil). Primera vez: `npx playwright install chromium` |

Copia `.env.example` a `.env` para configurar Supabase (solo claves públicas).

## Decisiones técnicas (Fase 3)

- **Router:** `HashRouter` (URLs `/#/catalogo`). GitHub Pages es estático, así que recargas y enlaces directos funcionan sin fallback. Se reevaluará con dominio propio.
- **Base path:** variable `VITE_BASE` (p. ej. `/pasteleria-luchy/`) para GitHub Pages.
- **Estilos:** Tailwind CSS 4 con los tokens de `design/tokens.css`; fuentes Poppins e Inter autoalojadas (`@fontsource`).
- **Estado:** TanStack Query (remoto) y Zustand (carrito, Fase 6).
- **Formularios:** React Hook Form + Zod con `@hookform/resolvers` 5 (la serie 6 genera conflictos de peers en npm).
- **CI:** `.github/workflows/ci.yml` (lint, typecheck, Vitest, Playwright). Aún no se ha ejecutado en GitHub: no hay remoto. El despliegue se añade en la Fase 10.

## Documentos

- [CLAUDE.md](CLAUDE.md): requisitos, reglas y roadmap de 10 fases.
- [docs/arquitectura.md](docs/arquitectura.md): flujo, estados, modelo de datos, decisiones, backlog y plan E2E.
- [docs/diseno.md](docs/diseno.md): sistema visual, contraste, componentes y revisión Opus.
- `design/prototipos/`: maquetas estáticas (abrir `index.html`).

## Pendientes antes de lanzamiento

Ver CLAUDE.md §14 (número de WhatsApp, cobertura, horarios, precios, políticas, dominio).
