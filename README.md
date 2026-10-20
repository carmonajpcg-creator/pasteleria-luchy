# Pastelería Luchy

Tienda web de repostería (español MX, MXN) con catálogo, carrito y pedido por WhatsApp. Nombre provisional.

## Estado

**Fase 7 — Administración: implementada y probada; PENDIENTE de revisión Opus** (CLAUDE.md §9 y §11: permisos, dinero e inventario). No se da por cerrada hasta esa revisión. Resultados del 2026-10-20:

- **Panel `/admin`** con carga diferida (el sitio público no descarga nada del panel): acceso con correo y contraseña (Supabase Auth), panel con pedidos por estado, ventas confirmadas, pagos registrados y stock bajo; bandeja de pedidos con búsqueda por folio; detalle con confirmar, preparación, listo, entregado y cancelar con motivo; pagos manuales con saldo; inventario con ajustes y movimientos auditados; CRUD de categorías y productos (los productos se desactivan, no se borran) con imágenes; configuración (WhatsApp con confirmación, zona horaria, caducidad).
- **Seguridad**: la autorización real está en RLS y en las RPC (`require_admin`); el panel solo decide qué pantalla mostrar. Sin sesión no se hace ninguna petición privada; un usuario sin rol ve «Sin permisos». Registro público de Auth **desactivado** (no hay cuentas de cliente). `noindex` en el panel. Los errores de la BD se traducen sin mostrar detalles internos.
- **Pruebas**: pgTAP 77 (33 de la fase + 44 previas), Vitest 99, Playwright 147 correctas y 1 omitida (teclado en móvil), lint, typecheck y build limpios; axe WCAG A/AA sin violaciones en las 9 pantallas del panel y sin desbordamiento horizontal.
- **Verificación real** contra `luchy-pruebas` (40 comprobaciones): inicio de sesión admin; pedido público → confirmar (stock −3) → doble confirmación simultánea sin doble descuento → anticipo (`partial`) → reembolso excesivo rechazado → transición inválida rechazada → cancelar repone stock; ajustes de inventario; producto creado/desactivado y su visibilidad pública; imagen PNG subida y eliminada, GIF y archivo de más de 2 MB rechazados por el servidor; el anónimo no puede subir imágenes, ver pedidos ni editar la configuración. Todo lo de prueba se borró (stock final 12).
- **Cambio de requisito justificado**: el test E01 de rutas del panel pasó de «muestra un marcador» a «sin sesión redirige al login».
- Puntos para la revisión Opus: `admin_dashboard()`, tabla de transiciones del cliente frente a `advance_order`, subida de archivos (ruta aleatoria, MIME y tamaño), manejo de sesión y caché al cerrar sesión, `ilike` de folio saneado, borrado de categorías, y el procedimiento de alta de administradores.
- Pendientes: fotos con licencia; recuperación de contraseña por correo (se restablece desde el panel de Supabase); límite por IP del login (lo gestiona Supabase Auth).

### Crear un administrador (proyecto de pruebas y producción)

No hay autoasignación de roles. Crear el usuario en *Authentication → Users* de Supabase (o con la API de administración) y, desde el SQL Editor con el rol `postgres`: `insert into public.profiles (user_id, role) values ('<uuid del usuario>', 'admin');`. El registro público está desactivado en `supabase/config.toml` (`enable_signup = false`); para aplicarlo en un proyecto nuevo: `supabase config push`. La cuenta del proyecto de pruebas usa `carmona.jpcg@gmail.com`; su contraseña está solo en variables de usuario de Windows, no en el repositorio.

## Fase 6 — Carrito y WhatsApp (completada con revisión Opus)

**Fase 6 — Carrito y WhatsApp: completada con revisión Opus** (2026-10-20). Hallazgos de la revisión y su corrección:

| # | Hallazgo | Severidad | Corrección |
|---|---|---|---|
| H1 | Fecha mínima del navegador (hora local, días) distinta a la del servidor (zona de la tienda, horas): rechazos inesperados por la tarde | Media | La zona horaria es pública y el cliente aplica la misma regla que `create_order` |
| H2 | Antispam comparaba el teléfono tal como se escribió; el servidor aceptaba teléfonos sin dígitos | Media | Comparación normalizada a dígitos e índice; mínimo 8 dígitos en el servidor |
| H3 | `expire_pending_orders()` nunca se ejecutaba | Media | Programada cada hora con `pg_cron` |
| H4 | La huella de idempotencia guardaba nombre/teléfono/notas en `sessionStorage` | Baja | Solo se guarda un SHA-256; candado síncrono contra doble envío |

Verificado tras las correcciones: pgTAP 44/44 (`20260101000400_revision_fase6.sql` aplicada en `luchy-pruebas`), Vitest 47/47, Playwright 97 correctas y 1 omitida, y prueba real (fecha mínima aceptada por el servidor, doble clic = 1 pedido, 0 aperturas a `wa.me`; pedido de prueba borrado).

Sin hallazgo: precios y total solo del servidor, sin descuento de stock al crear, idempotencia ante concurrencia, token en el fragmento `#` (no viaja a servidores ni en `Referer`).

Zona horaria de la tienda: **Piedras Negras, Coahuila → `America/Matamoros`** (franja fronteriza: horario central con cambio de horario de verano). Está configurada en el proyecto de pruebas; en producción se fijará desde el panel de configuración (Fase 7) o con `update public.store_settings set timezone = 'America/Matamoros'`. El valor por defecto de la migración sigue siendo `UTC`.

Pendiente consciente: límite por IP (Edge Function, D7).

Detalle de la implementación (2026-10-20):

- Carrito local (Zustand, persiste solo producto/cantidad/personalización), checkout con React Hook Form + Zod, `create_order` idempotente, página `/pedido/:folio?t=<token>` y enlace `wa.me` con el mensaje codificado.
- Vitest 44/44, lint y typecheck limpios, build correcto. Playwright 97 correctas y 1 omitida (teclado en móvil): cantidades, totales, validaciones, doble clic, reintento con la misma clave, cambio de carrito con otra clave, error de negocio, token inválido, axe y desbordamiento. El cliente nunca envía precios ni totales (verificado en la petición).
- Verificación real contra `luchy-pruebas`: pedido creado desde la interfaz, total recalculado por la BD ($690.00), `pending_contact`, sin stock descontado, consentimiento registrado, mensaje con folio/productos/personalización/total, 0 aperturas a `wa.me`, 0 errores de consola. El pedido de prueba se borró.
- **No se envía ningún mensaje**: el botón es un enlace que abre WhatsApp; las pruebas interceptan `wa.me`. Abrirlo no confirma el pedido y la interfaz lo dice antes y después de registrarlo.

Puntos para la revisión Opus: límite antispam solo por teléfono (el límite por IP queda para Edge Function, D7); `expire_pending_orders()` aún sin programar; el token de seguimiento viaja en la URL; nombre/notas/personalización se guardan en `sessionStorage` solo para armar el mensaje; fecha mínima del cliente en hora local frente a `timezone` de la tienda (hoy `UTC`, por definir).

## Fase 5 — Catálogo (completada)

**Fase 5 — Catálogo: completada** (Fases 1–4 completadas). Inicio, catálogo con búsqueda y filtro por categoría (en la URL), detalle de producto, contacto desde la configuración pública y páginas de nosotros/privacidad/condiciones como **borrador** pendiente de revisión. Resultados del 2026-10-20:

- Vitest 20/20, lint y typecheck limpios, build correcto.
- Playwright 71 correctas y 1 omitida (teclado en móvil): rutas, catálogo, filtros, búsqueda sin acentos, detalle, estados de error, axe WCAG A/AA y sin desbordamiento. Usa respuestas de Supabase simuladas (`tests/e2e/helpers.ts`); nunca toca la nube.
- Verificación manual con el build real contra `luchy-pruebas`: 20 productos, 4 cupcakes, detalle, 6 destacados, enlace `wa.me` con el número configurado, 0 errores de consola.
- Pendiente: fotos demo con licencia (hoy se muestra «Imagen de ejemplo»), botón «Agregar al carrito» (Fase 6; el detalle lo indica con una nota), regresión visual versionada, contenido definitivo de privacidad/condiciones/nosotros.

El número de WhatsApp de la tienda vive en la base de datos (`store_settings.whatsapp_number`), no en el código ni en el repositorio. En el proyecto de pruebas ya está configurado.

## Fase 4 — Base de datos y Supabase (completada) Migraciones y semillas aplicadas en el proyecto Supabase Cloud de pruebas `luchy-pruebas` (ref `qqstdkfnsnoivumakwza`, us-east-1). Resultados del 2026-10-19:

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
