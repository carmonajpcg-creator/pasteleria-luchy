# Pastelería Luchy

Tienda web de repostería (español MX, MXN) con catálogo, carrito y pedido por WhatsApp. Nombre provisional.

## Estado

**Fase 4 — Base de datos y Supabase: completada** (Fases 1–3 completadas). Migraciones y semillas aplicadas en el proyecto Supabase Cloud de pruebas `luchy-pruebas` (ref `qqstdkfnsnoivumakwza`, us-east-1). Resultados del 2026-10-19:

- 37/37 pruebas pgTAP correctas (`npm run test:db`).
- Sondeo de la API REST con clave pública: `anon` lee `catalog_products` (20) y la configuración pública. Obtiene 401 en `products`, `orders`, `store_settings.timezone` y `confirm_order`. `get_order_public` con token falso devuelve `null`.
- Sin regresiones: Vitest 5/5, build y Playwright 43 correctas (1 omitida).
- Siguiente: Fase 5 (catálogo), asignada a Sonnet.

## Base de datos (Fase 4)

| Archivo | Contenido |
|---|---|
| `supabase/migrations/…_esquema.sql` | Tablas, enums, pagos y movimientos solo de inserción, `payment_status` automático |
| `supabase/migrations/…_rls.sql` | Grants mínimos, RLS por rol, vista pública `catalog_products` (sin cifras de stock) |
| `supabase/migrations/…_rpc.sql` | `create_order` (idempotente, recalcula precios), `get_order_public` (folio + token), `confirm_order`, `advance_order`, `cancel_order`, `adjust_stock`, `expire_pending_orders` |
| `supabase/migrations/…_storage.sql` | Bucket `product-images` (JPEG/PNG/WebP, 2 MB, escritura solo admin) |
| `supabase/seed.sql` | 5 categorías y 20 productos ficticios con precios provisionales |
| `supabase/tests/database/` | 37 pruebas pgTAP: anon, usuario sin rol, admin, idempotencia, stock |

Se trabaja con **Supabase Cloud** (sin Docker). Contra un proyecto **de pruebas**:

1. Variables de usuario (fuera del repo): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` y `SUPABASE_DB_URL` (cadena *Session pooler*).
2. `npx supabase link --project-ref <ref>`
3. `npx supabase db push --include-seed`
4. `npm run test:db`: ejecuta las pruebas pgTAP con `scripts/test-db.mjs`, cada archivo dentro de una transacción revertida. `supabase test db` requiere Docker, por eso no se usa.

**Crear un administrador:** no hay autoasignación. Crear el usuario en Supabase Auth y, desde el SQL Editor (rol `postgres`), ejecutar `insert into public.profiles (user_id, role) values ('<uuid>', 'admin');`.

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
