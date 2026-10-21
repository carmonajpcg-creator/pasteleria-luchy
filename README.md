# Pastelería Luchy

Tienda web de repostería (español MX, MXN) con catálogo, carrito y pedido por WhatsApp. Nombre provisional.

## Estado

**Fase 10 — Publicación: PUBLICADA; pendiente de auditoría Opus y de contenido del negocio** (2026-10-21). Guía completa en [docs/publicacion.md](docs/publicacion.md).

- **Sitio:** https://carmonajpcg-creator.github.io/pasteleria-luchy/ (repositorio público `carmonajpcg-creator/pasteleria-luchy`; el nombre es provisional como el de la tienda).
- **Primer despliegue (CI en GitHub):** checks, deploy y smoke en verde. **Verificación independiente** desde otra máquina: HTTP 200, CSP presente, apunta al proyecto de producción y no contiene nada del de pruebas, y las 42 pruebas de humo de solo lectura pasan contra la URL pública (escritorio y móvil). **Monitoreo diario** probado con una ejecución manual: en verde.
- **Privacidad del historial:** antes de publicar se reescribieron los correos de autor al correo privado de GitHub (`…@users.noreply.github.com`) para no exponer el correo personal en un repositorio público; el árbol de archivos quedó idéntico. Solo se subió la rama `main` (sin etiquetas ni copias del historial anterior).
- **Permisos de Claude Code:** `.claude/settings.json` ahora permite únicamente `git push origin main`; `--force`, `--delete`, `--mirror` y `--tags` siguen bloqueados y cualquier otro envío pide confirmación.
- **Aviso de mantenimiento:** GitHub avisa de que `actions/checkout`, `setup-node`, `upload-artifact` y `deploy-pages` (v4) se ejecutan forzados en Node 24; funciona, pero conviene subirlos de versión cuando salgan las compatibles.

Hecho y verificado:

- **Proyecto de producción** `luchy-produccion` creado, con las 11 migraciones aplicadas desde cero (esquema reproducible), **sin datos ficticios**, zona horaria `America/Matamoros`, WhatsApp configurado, registro público desactivado, contraseñas de 12+ caracteres y un administrador. Verificado con clientes reales: anónimo sin acceso a lo privado, administrador con acceso.
- **Despliegue** (`.github/workflows/ci.yml`): checks → deploy a GitHub Pages (solo desde `main` y solo si pasaron; se niega a publicar sin las variables públicas o con una clave que no sea la publicable) → humo sobre la URL publicada.
- **Humo de solo lectura** (`npm run test:smoke`, 42 comprobaciones en escritorio y móvil): enlaces directos y recarga en 13 rutas, recursos bajo la subcarpeta del sitio, CSP, catálogo, enlace de WhatsApp (sin abrirlo), panel protegido. Pasa **42/42** contra el backend de producción servido en la subcarpeta `/pasteleria-luchy/`, como lo hará GitHub Pages.
- **Monitoreo diario** (`.github/workflows/monitoreo.yml`) con el mismo humo sobre `SITE_URL`.
- **Respaldo y recuperación probados** (`npm run backup`, `npm run restaurar`): se borró toda la base de pruebas, se restauró y las 11 huellas (cantidades, totales, stock, firmas de pedidos/productos/configuración) coincidieron exactamente; la restauración se niega a sobrescribir datos y es atómica.

**Pendiente:**

1. **Contenido y políticas del negocio** (docs/publicacion.md §5): productos y precios reales, fotos con licencia, textos legales revisados, horarios y cobertura, dominio. Hasta entonces la tienda publicada tiene el **catálogo vacío** y no debe anunciarse.
2. **Auditoría Opus** de la publicación (CLAUDE.md §11).
3. Las suites con credenciales (`test:db`, `test:concurrency`, `test:live`) no corren en GitHub Actions; la CI usa Playwright con datos simulados.

## Fase 9 — Seguridad y calidad (completada, Opus)

**Fase 9 — Seguridad y calidad: completada (Opus)** (2026-10-20).

| Área | Resultado |
|---|---|
| Auditoría de permisos | Todas las tablas con RLS; toda función privilegiada con `search_path` fijo; `anon` solo ejecuta 5 funciones y lee 3 tablas y 7 columnas públicas; nadie lista ni sube imágenes de forma anónima. Fijado como **regresión de seguridad** (`seguridad.test.sql`, 16 pruebas). |
| Límite por IP | `create_order` 10/h, `get_availability` y `get_order_public` 60/10 min. IP tomada de `cf-connecting-ip` (Cloudflare rechaza falsificarla) o de la última entrada de `x-forwarded-for` (la primera sí se puede falsificar; **verificado contra el proyecto real**). IP guardada como hash con sal en el esquema `private`; contadores purgados cada hora. Los reintentos del mismo pedido nunca se bloquean. |
| Concurrencia | Suite permanente `npm run test:concurrency` (16 comprobaciones con conexiones simultáneas reales): doble confirmación, confirmar vs. cancelar, última unidad, confirmación vs. merma, capacidad, envíos gemelos y reembolsos simultáneos. Nunca stock ni saldo negativos, nunca doble descuento. |
| Navegador | CSP estricta por `<meta>` (sin `unsafe-inline` ni `unsafe-eval`), 0 violaciones en el recorrido de compra y en el panel; el panel no se muestra dentro de un iframe (clickjacking). |
| Auth | Contraseña mínima de 12 caracteres; registro público ya desactivado (Fase 7). |
| Dependencias y secretos | `npm audit`: 0 vulnerabilidades. Sin secretos en archivos versionados, en el historial de git ni en el build (solo la clave publicable, que es pública por diseño). |
| E2E real | Suite permanente `npm run test:live`: build real contra `luchy-pruebas`; cliente pide → admin confirma (stock −2), cobra anticipo y cancela (stock repuesto); 0 errores de consola; limpia lo que crea. |

**Cómo ejecutar las suites contra el proyecto de pruebas** (nunca contra producción):

| Comando | Requiere | Qué hace |
|---|---|---|
| `npm run test:db` | `SUPABASE_DB_URL` | pgTAP: RLS, permisos, pedidos, inventario, fechas, límites (todo dentro de transacciones revertidas) |
| `npm run test:concurrency` | `SUPABASE_DB_URL`, `LUCHY_ENTORNO=pruebas` | Carreras reales con conexiones simultáneas; limpia al terminar |
| `npm run test:live` | lo anterior + `LUCHY_ADMIN_EMAIL`/`LUCHY_ADMIN_PASSWORD` | Navegador contra el backend real; limpia al terminar |

Pendiente para la Fase 10: estas tres suites necesitan credenciales y no corren en GitHub Actions; la CI ejecuta lint, typecheck, Vitest, build y Playwright con datos simulados.

## Fase 8 — Repostería especializada (completada con revisión Opus)

**Fase 8 — Repostería especializada: completada con revisión Opus** (2026-10-20).

Decisiones del negocio registradas (el propietario dejó las dos primeras a recomendación):

| Tema | Decisión |
|---|---|
| Qué cuenta como capacidad | Pedidos con productos bajo pedido por fecha (no unidades) |
| ¿Los pendientes reservan cupo? | Sí, hasta que caducan (48 h) |
| Domingos | **Sin recolección en tienda; sí hay entrega a domicilio** |
| Anticipación | **24 h general** para todo pedido, además de la de cada producto (pasteles: 48 h) |

Las cuatro son editables desde *Panel → Configuración*; la migración `20260101000900_revision_fase8.sql` deja domingo sin recolección y 24 h como valores iniciales.

Hallazgos de la revisión y corrección:

| # | Hallazgo | Severidad | Corrección |
|---|---|---|---|
| H1 | La idempotencia se comprobaba antes del bloqueo por fecha: un doble envío del mismo pedido por el último cupo hacía que el gemelo recibiera «Ya no hay cupo» aunque su pedido existía | Media | Tras tomar el bloqueo se vuelve a buscar la clave. Verificado en real: 3 envíos gemelos simultáneos → mismo folio, sin error, un solo pedido |
| H2 | Los cierres no distinguían modalidad (no se podía expresar «domingo solo entrega») | Media | `pickup_closed_weekdays`, motivo `pickup_closed` y mensaje que ofrece la entrega a domicilio; el checkout recalcula la disponibilidad al cambiar de modalidad |
| H3 | Confirmar un pendiente caducado podía rebasar la capacidad del día | Baja | El detalle del pedido avisa con el cupo del día (`admin_day_capacity`) y pide confirmación explícita |
| H4 | `get_availability` es pública y calcula hasta 121 días por llamada; sin límite por IP | Baja | **Pendiente para la Fase 9** (junto con límite por IP y CSP) |

También se corrigió una prueba antigua que dependía de la hora: usaba la fecha UTC del servidor frente a la zona de la tienda y fallaba solo por las tardes. Las pruebas de base de datos ahora fijan una configuración neutra y las reglas de fechas se prueban aparte.

Tras la revisión: pgTAP 122/122, Vitest 115/115, Playwright 193 correctas y 1 omitida, lint y typecheck limpios, y 10 comprobaciones reales (domingo por modalidad, 24 h, doble envío gemelo por el último cupo). Datos de prueba borrados.

Detalle de la implementación (2026-10-20):

- **Personalización por producto**: cada producto declara si la admite y con qué pista (`allows_customization`, `customization_hint`); la tienda solo muestra el campo en esos productos y el servidor rechaza personalización en los demás. Antes aparecía en todos los productos bajo pedido.
- **Fechas y anticipación**: anticipación por producto (ya existía) más una **anticipación general** configurable; **días de la semana y fechas cerradas** configurables; el checkout consulta `get_availability`, usa la primera fecha disponible como mínimo y explica por qué una fecha no sirve (ya pasó, falta anticipación, cerrado o sin cupo) sugiriendo la siguiente. Si no se puede consultar, decide el servidor.
- **Capacidad diaria** configurable (pedidos con productos bajo pedido por fecha solicitada). Un bloqueo por fecha dentro de `create_order` impide sobrevender cuando llegan pedidos a la vez. El panel muestra la carga de los próximos 14 días.
- **Valores por defecto neutros**: sin límite de capacidad, sin días cerrados y anticipación general 0. No se inventó ninguna política (CLAUDE.md §14).
- **Promociones**: no se incorporaron (CLAUDE.md §5 las deja como mejora posterior).
- **Pruebas**: pgTAP 108/108, Vitest 113/113, Playwright 185 correctas y 1 omitida (teclado en móvil), lint, typecheck y build limpios; axe WCAG A/AA sin violaciones en el checkout con errores de fecha, el campo de personalización y el panel con capacidad.
- **Verificación real** contra `luchy-pruebas` (24 comprobaciones): disponibilidad pública por motivo, personalización aceptada/rechazada y guardada, anticipación general, fecha y día de la semana cerrados, y **concurrencia: 3 pedidos simultáneos con capacidad 1 crearon exactamente uno** (los otros 2 recibieron «Ya no hay cupo»); cancelar libera el cupo; un pedido solo de existencia no consume cupo; reintentar con la misma clave devuelve el mismo pedido aunque el día esté lleno; `admin_capacity` solo para administradores. La verificación encontró que `admin_capacity` devolvía `closed: null` en días abiertos y se corrigió con una migración. Configuración restaurada y datos de prueba borrados.
- **Supuestos que debe decidir el negocio** (hoy son provisionales y configurables): qué cuenta como capacidad (aquí, pedidos y no unidades), si los pedidos pendientes de confirmar deben reservar cupo (aquí sí, hasta que caducan), qué días se cierra y la anticipación real.
- Puntos para la revisión Opus: bloqueo `pg_advisory_xact_lock` por fecha y su interacción con la idempotencia, conteo de pendientes vencidos en `capacity_used`, que `get_availability` no revele el volumen de pedidos, la carrera entre cancelar o caducar y crear, y los mensajes de error.

## Fase 7 — Administración (completada con revisión Opus)

**Fase 7 — Administración: completada con revisión Opus** (2026-10-20). Hallazgos y corrección:

| # | Hallazgo | Severidad | Corrección |
|---|---|---|---|
| H1 | El cliente de Supabase es único: con sesión de admin, la tienda pública recibía de RLS también las categorías inactivas | Media | La tienda filtra `active = true` explícitamente; prueba E2E con sesión de admin y prueba pgTAP |
| H2 | Alérgenos «verificados» sin lista se mostraban como «por verificar», contradiciendo al panel | Media | La tienda muestra «ninguno declarado por la tienda»; el panel explica los tres casos |
| H3 | La zona horaria solo se validaba en el formulario; un valor inválido rompería todos los pedidos con un error técnico visible | Media-baja | Disparador `store_settings_validate` (zona existente y caducidad ≤ 720 h), migración `20260101000600_revision_fase7.sql` |
| H4 | La bandeja de pedidos se cortaba en 100 sin avisar | Baja | Aviso visible y la búsqueda por folio sigue alcanzando pedidos antiguos |
| H5 | Sin política de contenido (CSP): el token del admin vive en `localStorage` | Baja ahora | **Pendiente para la Fase 9** (CSP por `<meta>`, GitHub Pages no admite cabeceras) |

Sin hallazgo: confirmación y cancelación concurrentes, pagos y movimientos solo de inserción, stock sin escritura directa, subida de archivos, redirección del login, mensajes de error y cierre de sesión. Tras las correcciones: pgTAP 82/82, Vitest 99/99, Playwright 153 correctas y 1 omitida, lint y typecheck limpios.

Detalle de la implementación (2026-10-20):

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
