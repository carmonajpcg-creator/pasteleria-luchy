# CLAUDE.md — Pastelería Luchy

> Documento rector para Claude Code. Leer este archivo al comenzar cada sesión. Mantenerlo actualizado cuando se adopten decisiones de arquitectura o cambien los requisitos. El nombre «Pastelería Luchy» es provisional.

## 1. Objetivo y alcance

Desarrollar una tienda web de repostería en español (México), con catálogo, búsqueda, filtros, detalle de producto, carrito, checkout que prepara el pedido para enviarlo por WhatsApp, inventario y panel administrativo. El negocio podrá atraer clientes desde WhatsApp, pero la selección de productos ocurre en la web. **No integrar pasarela de pagos en el MVP.** Los pagos/anticipos se registran manualmente por un administrador; cualquier pago en línea futuro exige diseño y aprobación independientes.

Principios: experiencia mobile-first, diseño atractivo morado/verde, simplicidad operativa, seguridad desde la base, accesibilidad y crecimiento incremental.

### Flujo de compra definido

1. Visitante navega el catálogo y agrega productos al carrito.
2. Checkout solicita nombre, contacto, modalidad y fecha solicitada de entrega/recolección, más notas opcionales. Validar consentimientos y política de privacidad antes de recopilar datos personales.
3. El **backend** recalcula precios, total y disponibilidad; crea un pedido con folio e indicador `pending_contact` (pendiente de contacto) de forma idempotente.
4. La aplicación arma un mensaje legible con folio, productos, cantidades, subtotal/total estimado, datos indispensables y preferencias; abre un enlace `https://wa.me/<numero>?text=<texto_codificado>` al número de la tienda configurable por administrador.
5. **Abrir WhatsApp NO demuestra que el mensaje se haya enviado ni que el pedido esté confirmado.** No marcar ventas como confirmadas ni descontar definitivamente inventario solo por crear el pedido o abrir WhatsApp.
6. Administrador coteja la conversación con el folio, confirma el pedido y registra manualmente anticipos/pagos. La transición a confirmado debe operar con control transaccional de stock y evitar doble descuento. Se permite cancelación y reversión auditada según política.

No automatizar envíos de mensajes por WhatsApp ni simular confirmación externa. En pruebas verificar URL/texto y simular apertura sin enviar mensajes reales. Estudiar protección contra spam, límites por IP y caducidad de pedidos no confirmados.

## 2. Tecnologías aprobadas

- Frontend: **React + Vite + TypeScript (strict)**.
- UI: Tailwind CSS, componentes accesibles y reutilizables.
- Rutas: React Router; considerar base path de GitHub Pages, rutas profundas y solución de fallback o hash routing si corresponde.
- Estado remoto: TanStack Query; carrito local: Zustand (persistencia controlada) o Context si basta; decidir una alternativa y documentarla.
- Formularios: React Hook Form + Zod.
- Backend: Supabase Cloud (PostgreSQL, Auth, Storage, Row Level Security, RPC y/o Edge Functions para operaciones privilegiadas).
- Hosting inicial: GitHub Pages para frontend estático; dominio personalizado más adelante. No depender de servidor Node en GitHub Pages.
- Testing: Playwright Test para E2E y visual; añadir Vitest/Testing Library para lógica y componentes cuando proceda; pruebas SQL/RLS y transacciones en backend.
- CI: GitHub Actions para lint, typecheck, tests, build y despliegue controlado.
- Idioma: español de México, moneda MXN, formato local de fechas. Zona horaria y cobertura de entregas quedan **por definir**; no asumir ciudad, costos ni horarios.

**Seguridad de credenciales:** solo usar en frontend claves públicas de Supabase diseñadas para cliente, con RLS rigurosa. Nunca insertar `service_role`, secrets de Edge Functions, tokens privados o contraseñas en Vite, código cliente, repositorio o builds públicos. Variables `VITE_*` son públicas.

## 3. Identidad visual

Inspiración general de interfaz limpia y orientada a repostería de https://www.repostery.com/reposteras ; **no copiar diseño, imágenes ni contenido protegido**.

- Morado principal `#7C3AED`; morado suave `#A78BFA`.
- Verde principal `#16A34A`; verde suave `#86EFAC`.
- Fondo claro `#FFF7FB`; blanco `#FFFFFF`.
- Texto principal `#2D1B3D`; texto secundario `#6B7280`.
- Tipos sugeridos: Poppins para títulos, Inter para cuerpo (sujeto a revisión de legibilidad y rendimiento).
- Diseño mobile-first, espacios generosos, fotografías de calidad con licencia, tarjetas de producto, estados de foco visibles, contraste suficiente, controles táctiles cómodos; respetar `prefers-reduced-motion`.
- Las imágenes demo deberán estar identificadas como ejemplos y reemplazarse por fotografías/autorizaciones propias para producción.

## 4. Catálogo inicial (datos ficticios, no precios reales)

Crear **20 registros semilla** repartidos en cinco categorías, con nombres, descripción, SKU, foto demo autorizada, precio **provisional editable**, disponibilidad, preparación y estado activo:

**Pasteles (5):** Pastel de vainilla con buttercream; Pastel de chocolate fudge; Pastel red velvet; Pastel de tres leches; Cheesecake de fresa.

**Cupcakes (4):** Cupcake de vainilla; Cupcake de chocolate; Cupcake de zanahoria; Cupcake red velvet.

**Galletas (3):** Galletas con chispas de chocolate; Galletas de mantequilla decoradas; Galletas de avena con canela.

**Brownies y barras (3):** Brownie clásico; Brownie con nuez; Barra de limón.

**Postres individuales y cajas (5):** Pay de queso individual; Mini tiramisú; Flan napolitano; Chocoflan; Caja surtida de postres.

No presentar valores ficticios como precios comerciales aprobados. Considerar información de alérgenos como campo administrable y evitar afirmaciones sin verificar.

## 5. Funcionalidades del MVP

### Cliente
- Home, categorías y productos destacados; catálogo con búsqueda y filtros.
- Detalle con fotos, precio, disponibilidad, descripción, tiempo de preparación y opciones soportadas.
- Carrito con cambiar cantidad, eliminar, persistencia y total estimado.
- Checkout validado: contacto, fecha, entrega/recolección, notas y personalización donde aplique.
- Creación segura del pedido, folio, resumen y enlace prellenado de WhatsApp.
- Página de instrucciones después de iniciar contacto; aclarar que la tienda debe confirmar el pedido.
- Contacto, redes, horarios y cobertura configurables; privacidad y condiciones de pedidos.

### Administrador
- Autenticación y autorización real, protegidas en base de datos, **no solo ocultar rutas**.
- Dashboard básico: pedidos por estado, ventas confirmadas/registradas y productos con stock bajo.
- CRUD de categorías y productos; imágenes en Storage con políticas correctas.
- Gestión de inventario de **productos terminados** y movimientos auditados; futuro soporte de ingredientes y recetas sin implementarlo prematuramente.
- Bandeja de pedidos, búsqueda por folio, confirmación manual, preparación, listo, entregado y cancelado.
- Registro manual de anticipos/pagos, métodos y saldos; no capturar datos de tarjeta.
- Configuración editable del número de WhatsApp, nombre, medios de contacto y parámetros operativos.
- Promociones sencillas como mejora posterior si el MVP queda estable.

### Fuera de alcance inicial
Pasarela de pago en línea, sistema de reparto en tiempo real, ERP de ingredientes, programa de puntos, IA generativa en tienda, cuentas obligatorias para clientes y notificaciones automáticas por WhatsApp.

## 6. Páginas y navegación

Públicas: `/`, `/catalogo`, `/producto/:slug`, `/carrito`, `/checkout`, `/pedido/:folio` (mostrar solo información no sensible o proteger mediante token seguro), `/nosotros`, `/contacto`, `/privacidad` y `/condiciones`.

Admin: `/admin/login`, `/admin`, `/admin/productos`, `/admin/categorias`, `/admin/inventario`, `/admin/pedidos`, `/admin/clientes` si justificado, `/admin/configuracion`.

La estrategia final para rutas de GitHub Pages se define y documenta en la Fase 3; garantizar que recarga y enlaces directos no rompan la app.

## 7. Datos y reglas de backend

Entidades orientativas (ajustables antes de escribir migraciones):
- `profiles` (roles vinculados a `auth.users`, con control estricto), `categories`, `products`, `product_images`.
- `orders`, `order_items` (snapshots de nombre/precio para preservar historial), `inventory_movements`, `payments` (registro manual), `store_settings`.
- Cliente como datos mínimos del pedido; `customers` opcional si se requiere historial y hay base legal/operativa.

Estados sugeridos: `pending_contact`, `confirmed`, `in_preparation`, `ready`, `delivered`, `cancelled`. Estado de pago independiente (`unpaid`, `partial`, `paid`, `refunded` según alcance).

Reglas obligatorias:
- Operaciones monetarias en MXN con `numeric` decimal apropiado o enteros de centavos; **no confiar en cálculos JS para persistencia de precios**.
- Precios y stock siempre recalculados/validados del lado confiable; no aceptar totales del cliente.
- Confirmar pedido y reservar/descontar stock en operación atómica e idempotente; manejar concurrencia y cancelaciones.
- Para productos fabricados bajo pedido, especificar disponibilidad/capacidad y política de reserva antes de habilitar venta; no asumir que todos son artículos de stock inmediato.
- Mínimo privilegio: habilitar RLS en tablas expuestas, políticas explícitas por rol y pruebas de acceso anónimo/cliente/admin. No permitir que cualquier usuario se autoasigne rol admin.
- Proteger lectura de datos personales y enlaces de pedidos, evitar exponer datos por folios secuenciales.
- Reglas claras de archivos: validar MIME, tamaño, acceso público/privado, y sanitizar entradas.
- Crear migraciones reproducibles, semillas de prueba y respaldos/plan de recuperación apropiados.

## 8. Arquitectura de código propuesta

```text
src/
  app/                 # proveedores, configuración y router
  components/          # UI transversal
  features/
    catalog/
    cart/
    checkout/
    orders/
    inventory/
    admin/
    auth/
  lib/                 # cliente supabase, configuración, utilidades
  hooks/
  styles/
  types/
supabase/
  migrations/
  functions/           # si se requieren endpoints seguros
  tests/
tests/
  e2e/
  visual/
  fixtures/
.claude/
  skills/
    luchy-frontend/SKILL.md
    luchy-supabase/SKILL.md
    luchy-playwright/SKILL.md
    luchy-code-review/SKILL.md
.github/workflows/
playwright.config.ts
CLAUDE.md
README.md
```

Arquitectura por funcionalidades sin sobreingeniería. Separar UI, consultas, validaciones y operaciones sensibles. Preferir interfaces tipadas y contratos explícitos.

## 9. Modelos de Claude

**Usar exclusivamente Claude Opus y Claude Sonnet; NO usar Haiku.**
- **Opus:** arquitectura, decisiones de datos, RLS, seguridad, depuración compleja, auditoría y revisión crítica.
- **Sonnet:** implementación React/TypeScript, componentes, integración, refactor, pruebas automatizadas y documentación corriente.
- Si una implementación presenta riesgos de privacidad, dinero, inventario o permisos, solicitar revisión de Opus antes de darla por terminada.
- Seleccionar la versión disponible más apropiada de cada familia; no fijar una numeración que pueda quedar obsoleta.

## 10. Skills y herramientas recomendadas

Revisar seguridad, licencia, compatibilidad y contenido de repositorios externos antes de instalar; **no dar por instaladas herramientas que no se hayan configurado**.

Referencias externas:
- Vercel Agent Skills: https://github.com/vercel-labs/agent-skills (React y diseño, según contenido actual).
- Anthropic Skills: https://github.com/anthropics/skills (estructura de skills).
- Playwright Test: https://playwright.dev/ ; Playwright MCP: https://github.com/microsoft/playwright-mcp (MCP es complemento, no una skill por sí mismo).
- Supabase Docs: https://supabase.com/docs para crear reglas locales actualizadas.

Skills locales previstas en `.claude/skills/`:
- `luchy-frontend`: tokens, componentes, responsive y accesibilidad.
- `luchy-supabase`: migraciones, RLS, manejo de pedidos, inventario seguro.
- `luchy-playwright`: diseño/ejecución de E2E, screenshots, regresión.
- `luchy-code-review`: calidad, tipos, seguridad y coherencia con este documento.

Estas skills se crearán como archivos independientes `SKILL.md` y se validarán; este documento no sustituye sus implementaciones.

## 11. Roadmap obligatorio (10 fases)

Cada fase requiere entregables, criterios de aceptación, pruebas aplicables, revisión de errores y commit de Git. La duración es orientativa.

| Fase | Responsable recomendado | Entregable | Playwright / pruebas |
|---|---|---|---|
| 1. Planeación y arquitectura | Opus | MVP, diagramas, reglas, backlog, CLAUDE.md | Definir escenarios de aceptación y plan E2E; smoke test cuando exista la app. |
| 2. Diseño UI/UX | Sonnet, revisión Opus | Sistema visual y prototipos | Comparaciones visuales de pantallas disponibles; móvil/escritorio y accesibilidad inicial. |
| 3. Configuración técnica | Sonnet | Vite, router, CI, Playwright | Smoke test, rutas y ausencia de errores de consola. |
| 4. Base de datos y Supabase | Opus | Migraciones, RLS, datos semilla | E2E de auth y flujos disponibles + pruebas específicas de políticas SQL/RLS. |
| 5. Catálogo | Sonnet | Home, 20 productos, filtros, detalle | Búsqueda, categorías, imágenes, disponibilidad, responsive. |
| 6. Carrito y WhatsApp | Sonnet, revisión Opus | Checkout, pedido, folio, wa.me | Cantidades, totales, validaciones, idempotencia, URL/mensaje; **sin enviar mensajes**. |
| 7. Administración | Sonnet | Login, CRUD, inventario, pedidos | Permisos, CRUD, movimientos, cambios de estado y casos negativos. |
| 8. Repostería especializada | Sonnet | Personalización, fechas, anticipación | Campos, fechas válidas/inválidas, capacidad y promociones si se incorporan. |
| 9. Seguridad y calidad | Opus | Auditoría, regresión, correcciones | Suite E2E integral, tests de integración y concurrencia, pruebas RLS. |
| 10. Publicación | Sonnet, auditoría Opus | GitHub Pages, documentación, monitoreo | Smoke tests en URL pública, rutas directas, assets y flujo WhatsApp. |

**No declarar una fase completada si sus pruebas aplicables fallan o no se han ejecutado.** Si una fase es aún documental, diseñar los tests y registrar que la ejecución está pendiente hasta tener un sistema comprobable.

## 12. Estrategia de pruebas

- Instalar `@playwright/test` en Fase 3 y configurar Chromium desktop + viewport móvil. Ampliar navegadores si es útil.
- Organizar `tests/e2e` por funcionalidades y `tests/visual` para capturas y regresión visual.
- Probar rutas esenciales, catálogo, filtros, carrito, checkout, enlace de WhatsApp, autorización admin y gestión de pedidos.
- Para WhatsApp, interceptar/comprobar el destino `wa.me` y su texto URL-encoded; **no enviar mensajes reales** ni asumir su recepción.
- No apuntar operaciones destructivas a datos de producción. Usar un proyecto/entorno Supabase de pruebas, fixtures deterministas y limpieza controlada.
- Configurar CI con lint, TypeScript, pruebas unitarias/integración, Playwright y build; publicar solo si pasan los checks definidos.
- Playwright **no sustituye** pruebas de políticas RLS, race conditions, transacciones o seguridad backend; agregar esas suites cuando corresponda.
- No alterar expectativas solo para que una prueba pase; diagnosticar y corregir implementación o justificar un cambio de requisito.
- No guardar credenciales ni información personal real en screenshots, trazas, fixtures, logs o artefactos de CI.

### Criterio de terminación de cada fase

1. Funcionalidad o documento entregable completo y revisado.
2. Criterios de aceptación explícitos cumplidos.
3. Pruebas Playwright aplicables implementadas **y ejecutadas** con resultados registrados.
4. Pruebas unitarias, integración y backend aplicables superadas.
5. Revisión mobile-first, accesibilidad básica y consola sin errores bloqueantes.
6. Cambios documentados en README/CLAUDE.md y commit identificable.
7. Bloqueantes y decisiones pendientes declarados, nunca ocultos.

## 13. Instrucciones operativas para Claude Code

Al recibir una tarea:
0. **Sincronizar con el remoto (regla estricta, trabajo en equipo de 2 personas):** antes de cualquier otra cosa, verificar si hay cambios por obtener desde git (`fetch` y comparar la rama con su remota). Ver «Regla estricta: sincronizar con git».
1. Leer este `CLAUDE.md`, identificar fase activa y revisar estructura existente.
2. Resumir objetivo, archivos afectados, riesgos, supuestos y pruebas necesarias.
3. Si falta una decisión crítica (p. ej., número de WhatsApp, horarios, áreas de entrega, política de anticipos), señalarla y usar configuración/placeholder seguro en vez de inventarla.
4. Implementar el cambio **mínimo coherente** y mantener tipado estricto.
5. Añadir/ajustar pruebas automatizadas para la funcionalidad.
6. Ejecutar comandos de lint, typecheck, test y build disponibles. Nunca afirmar ejecución de pruebas no realizadas.
7. Informar archivos cambiados, resultados, limitaciones, y siguiente paso. Solicitar revisión Opus ante cambios sensibles.

### Regla estricta: sincronizar con git

En este repositorio trabajan **dos personas**. **SIEMPRE se debe verificar si hay cambios que obtener desde git** (instrucción del propietario, 2026-10-21).

- Al iniciar cada sesión y antes de empezar cualquier tarea, hacer `fetch` y comprobar si la rama actual va por detrás de su remota. Repetir la verificación antes de hacer commit y antes de hacer push.
- Si hay cambios remotos y el árbol de trabajo está limpio, integrarlos (`pull`, preferentemente fast-forward o rebase) antes de continuar, y revisar qué cambió por si afecta la tarea.
- Si hay cambios locales sin commit que pueden chocar con los remotos, o la integración produce conflictos, **no sobrescribir ni descartar trabajo de nadie**: detenerse, informar al usuario y resolver con su aprobación. Prohibido `push --force`, `reset --hard` o reescribir historial sin autorización explícita.
- Informar al usuario del resultado de la verificación (al día, cambios integrados o conflicto), sin listar los comandos, conforme a la regla siguiente.

### Regla estricta: no reportar comandos

**NO REPORTAR AL USUARIO LOS COMANDOS EJECUTADOS Y EJECUTARLOS SIN PEDIR CONFIRMACIÓN** (instrucción del propietario, 2026-10-20).

- En los mensajes al usuario no se listan, citan ni explican los comandos que se corrieron (npm, npx, git, supabase, node, PowerShell). Se informan **resultados**: qué pasó, cifras de pruebas, errores y decisiones. Excepción: cuando el propio usuario deba ejecutar algo que Claude no puede hacer (p. ej. iniciar sesión en el navegador).
- Los comandos de desarrollo del proyecto se ejecutan sin preguntar si se pueden correr. No se piden confirmaciones por comandos rutinarios.
- Esta regla no cambia las demás: no afirmar pruebas no ejecutadas, no usar credenciales fuera de variables de usuario, no apuntar operaciones destructivas a producción y confirmar antes de acciones irreversibles que afecten sistemas externos.

No inventar productos comerciales aprobados, precios, domicilios, teléfonos, políticas de envío ni promesas de entrega. Los datos de demostración son ficticios. Mantener instrucciones, comentarios significativos y documentación en español, salvo nombres técnicos propios del stack.

## 14. Pendientes por definir antes de lanzamiento

- Número de WhatsApp de la tienda en formato internacional (configurable; no hardcode).
- Área de cobertura, horarios, modalidad de entrega/recolección y posibles costos.
- Precios reales, fotos y descripción final de cada producto.
- Política de preparación, anticipación, cambios, cancelaciones y anticipos.
- Política de inventario para artículos bajo pedido frente a inventario físico.
- Identidad final del negocio y dominio.
- Aviso de privacidad y condiciones comerciales revisados para el contexto aplicable.

---

**Estado:** versión inicial operativa de `CLAUDE.md` basada en decisiones actuales. Modificar con control de versiones conforme avance el proyecto.
