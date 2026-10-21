# Publicación y operación — Pastelería Luchy (Fase 10)

> Guía para publicar, operar y recuperar la tienda. Los valores marcados **por definir** dependen del
> negocio (CLAUDE.md §14) y no se inventan.

## 1. Entornos

| Entorno | Proyecto Supabase | Para qué sirve | Datos |
|---|---|---|---|
| Pruebas | `luchy-pruebas` (`qqstdkfnsnoivumakwza`) | Pruebas automáticas y verificaciones reales | Ficticios; se borran al terminar cada prueba |
| Producción | `luchy-produccion` (`etkbhmrneuzfvykdmavk`) | El sitio publicado | **Reales.** Ninguna suite escribe aquí |

Regla: las suites que escriben (`test:db`, `test:concurrency`, `test:live`) usan `SUPABASE_DB_URL` del
proyecto de **pruebas** y exigen `LUCHY_ENTORNO=pruebas`. Las credenciales de producción viven en variables
de usuario distintas (`SUPABASE_PROD_DB_URL`, `SUPABASE_PROD_DB_PASSWORD`, `LUCHY_PROD_ADMIN_*`) para que
ningún script de pruebas las use por accidente.

## 2. Qué es público y qué no

- **Público por diseño** (se publica en el sitio y en GitHub): la URL del proyecto y la clave **publicable**
  (`sb_publishable_…`). La seguridad real está en RLS y en las funciones del servidor.
- **Secreto** (nunca en el repositorio, el build ni los registros): contraseña de la base de datos, cadena
  de conexión, clave `service_role`/`sb_secret_…`, contraseñas de administrador y el token de GitHub.
- El repositorio se escanea en cada revisión: sin secretos en archivos, historial ni build (Fase 9).

## 3. Publicar en GitHub Pages

Sitio actual: **https://carmonajpcg-creator.github.io/pasteleria-luchy/**. Se sirve desde
`https://<usuario>.github.io/<repositorio>/`. El flujo `.github/workflows/ci.yml`:

1. `checks`: lint, typecheck, Vitest, Playwright (con Supabase simulado).
2. `deploy` (solo en `main` y solo si `checks` pasó): construye con `VITE_BASE=/<repositorio>/` y las
   **variables del repositorio** `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; se niega a desplegar si
   faltan o si la clave no es la publicable.
3. `smoke`: humo de solo lectura sobre la URL recién publicada.

Configuración única del repositorio (variables, **no** secretos, porque son públicas):

```
VITE_SUPABASE_URL       = https://etkbhmrneuzfvykdmavk.supabase.co
VITE_SUPABASE_ANON_KEY  = <clave publicable de producción>
SITE_URL                = https://<usuario>.github.io/<repositorio>/     (para el monitoreo diario)
```

Y en *Settings → Pages → Source*: **GitHub Actions**.

**Rutas.** La app usa `HashRouter` (`/#/catalogo`): las recargas y los enlaces directos funcionan sin
servidor, sin `404.html` ni reescrituras. Se verificó con enlaces directos y recarga en 13 rutas.

## 4. Administrador de producción

No hay autoasignación de roles ni registro público. El administrador ya está creado; para cambiar su
contraseña o añadir otro:

1. *Supabase → Authentication → Users*: crear el usuario (o restablecer su contraseña, mínimo 12 caracteres).
2. SQL Editor (rol `postgres`): `insert into public.profiles (user_id, role) values ('<uuid>', 'admin');`

La contraseña inicial está **solo** en la variable de usuario de Windows `LUCHY_PROD_ADMIN_PASSWORD`;
cámbiala al primer acceso y bórrala de esa variable.

## 5. Lanzamiento: lo que debe definir el negocio

Con el catálogo de producción **vacío**, antes de abrir al público hay que capturar desde el panel:

- [ ] Productos reales: nombre, descripción, **precio real**, fotos propias o con licencia (marcar «imagen de ejemplo» solo si no lo son), alérgenos verificados, anticipación y tipo (existencia o bajo pedido).
- [ ] Categorías reales.
- [ ] Horarios y cobertura de entregas (hoy «por definir» en la tienda).
- [ ] Política de anticipos, cambios y cancelaciones; **revisión del aviso de privacidad y de las condiciones** (hoy son borradores).
- [ ] Nombre y dominio definitivos (el dominio propio se configura después en *Pages → Custom domain*).
- [ ] Capacidad diaria y días cerrados reales (hoy: domingo sin recolección pero con entrega, anticipación 24 h, sin límite de capacidad).

Ya configurado en producción: zona horaria `America/Matamoros`, WhatsApp `528787030104`, registro público
desactivado, contraseñas de al menos 12 caracteres.

## 6. Monitoreo

- **Humo diario** (`.github/workflows/monitoreo.yml`, 14:17 UTC): 42 comprobaciones de solo lectura contra el
  sitio real (rutas directas, recursos, CSP, catálogo, WhatsApp, panel protegido, sin desbordamiento). Si
  falla, GitHub envía un correo de «workflow failed»; activar en *Settings → Notifications → Actions*.
- **Después de cada despliegue**: el trabajo `smoke` repite el humo sobre la URL recién publicada.
- **Panel**: *Panel → Carga de los próximos 14 días* y *Stock bajo* para el negocio.
- **Supabase**: *Reports* y *Logs* del proyecto de producción para errores de la API; el plan gratuito
  **pausa** el proyecto tras 7 días sin actividad (el monitoreo diario también sirve para mantenerlo activo).

## 7. Respaldo y recuperación

El **esquema** está versionado (`supabase/migrations`) y es reproducible: se aplicó a un proyecto vacío sin
errores. Los **datos** se respaldan con un script lógico (instantánea coherente, solo lectura):

```
SUPABASE_DB_URL=<cadena Session pooler de producción>  npm run backup
```

Genera `backups/luchy-AAAAMMDD-HHMMSS.json` con categorías, productos, imágenes, pedidos, líneas, pagos,
movimientos, configuración y los ids/correos de administradores (nunca contraseñas). **Contiene datos
personales de clientes**: no se versiona (`backups/` está ignorado); guárdalo cifrado y fuera del equipo.

**Frecuencia recomendada:** semanal, y siempre antes de cambios grandes. El plan gratuito de Supabase
**no incluye respaldos automáticos descargables**; el plan de pago añade copias diarias y recuperación a un
punto en el tiempo, recomendable cuando haya pedidos reales (decisión del negocio).

**Recuperar tras un desastre** (probado: se borró toda la base de pruebas, se restauró y las huellas de
pedidos, productos, configuración, totales y stock coincidieron exactamente):

1. Crear un proyecto nuevo y aplicar el esquema: `supabase db push --db-url <destino>` (sin semillas).
2. Recrear al administrador con **el mismo id** que tenía (está en `datos.admins` del respaldo).
3. `LUCHY_RESTAURAR=SI SUPABASE_DB_URL=<destino> npm run restaurar -- backups/<archivo>.json`

La restauración **nunca sobrescribe**: se niega si alguna tabla del destino tiene filas y, si falla a mitad,
no cambia nada (una sola transacción). Las imágenes viven en Storage y no están en el respaldo: exportar el
bucket `product-images` desde el panel de Supabase si se necesita copia.

## 8. Revertir un despliegue

El sitio es estático: volver a una versión anterior = volver a ejecutar el flujo sobre el commit anterior
(*Actions → CI y despliegue → Re-run* sobre ese commit) o `git revert` + push. Los datos no se ven afectados.
Si una migración nueva falla en producción, no se edita la aplicada: se escribe otra migración correctiva.

## 9. Qué NO se prueba en producción

Los pedidos reales no se simulan: el humo de producción es de solo lectura. El recorrido completo de compra
→ confirmación → pago → cancelación se verifica en el proyecto de pruebas (`npm run test:live`) y con
Supabase simulado en CI; el envío por WhatsApp nunca se automatiza (solo se verifica el enlace y el texto).
