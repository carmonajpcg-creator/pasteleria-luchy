# Sistema visual — Pastelería Luchy (Fase 2)

Tokens en [design/tokens.css](../design/tokens.css); prototipos estáticos en [design/prototipos/](../design/prototipos/) (abrir `index.html`). Son maquetas con datos e imágenes de ejemplo: no son precios ni productos comerciales. Inspiración general de interfaz limpia de repostería; no se copia diseño, imágenes ni contenido de terceros.

## Paleta y contraste (WCAG 2.1, calculado)

| Uso | Combinación | Ratio | Resultado |
|---|---|---|---|
| Botón primario | Blanco sobre `#7C3AED` | 5.70 | AA |
| Botón WhatsApp | Blanco sobre `#15803D` | 5.02 | AA |
| Texto principal | `#2D1B3D` sobre `#FFF7FB` | 14.94 | AAA |
| Texto secundario | `#6B7280` sobre `#FFF7FB` | 4.59 | AA (solo ≥14 px) |
| Enlaces | `#6D28D9` sobre `#FFF7FB` | 6.75 | AA |
| Texto sobre verde suave | `#2D1B3D` sobre `#86EFAC` | 11.20 | AAA |

**Desviación respecto a CLAUDE.md §3:** el verde principal `#16A34A` con texto blanco da **3.30:1** y no cumple AA para texto normal. Se usa `#15803D` para botones y texto verde; `#16A34A` queda solo para elementos gráficos/decorativos (mínimo 3:1). El morado, el verde suave y los neutros se mantienen como están definidos.

## Tipografía

Poppins (títulos, 600/700) e Inter (cuerpo, 400/600). Los prototipos las cargan desde Google Fonts; **en la Fase 3 se autoalojarán** (privacidad y rendimiento) y se limitarán los pesos.

## Componentes definidos

Cabecera con navegación (`aria-current`), botones (primario, WhatsApp, contorno), chips de filtro (`aria-pressed`), tarjeta de producto con insignia de disponibilidad, campos de formulario con etiqueta y error (`role="alert"`), selector de cantidad con etiquetas accesibles, panel, aviso (`role="note"`), pie de página, etiqueta «Imagen de ejemplo».

## Reglas de accesibilidad y UX

- Mobile-first; sin desbordamiento horizontal en 390 px ni 1280 px (verificado).
- Controles táctiles ≥ 48 px (chips 44 px).
- Foco visible en todos los elementos interactivos (anillo morado doble); enlace «Saltar al contenido».
- `prefers-reduced-motion` desactiva transiciones.
- Estado de disponibilidad con texto, no solo color. Insignias: `#14532D` sobre `#DCFCE7` y `#78350F` sobre `#FEF3C7`.
- Aviso permanente en checkout: abrir WhatsApp **no confirma** el pedido.
- Valores no definidos (precios, horarios, cobertura, tiempo de preparación) se muestran como «por definir» o `$000.00`, nunca inventados.

## Pantallas prototipadas

Inicio, catálogo (búsqueda + filtros), detalle de producto (con personalización opcional y alérgenos «por verificar»), carrito + checkout. Pendientes para fases posteriores: página de instrucciones post-pedido, `/pedido/:folio`, contacto, privacidad, condiciones y panel admin.

## Verificación realizada

- Capturas con Playwright (Edge, móvil 390×844 y escritorio 1280×800) de las 4 pantallas: 0 errores de consola, sin desbordamiento horizontal.
- Se detectaron y corrigieron: cabecera descuadrada en móvil y título pegado a la cabecera.
- Auditoría automatizada axe-core (WCAG 2.0/2.1 A y AA) en las 4 pantallas: **0 violaciones**. Primer foco de teclado: «Saltar al contenido».
- **No realizado:** prueba con lector de pantalla y línea base de regresión visual versionada (Playwright se instala en el proyecto en la Fase 3).

## Revisión Opus (2026-10-19)

Hallazgos y resolución:

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| R1 | Botón «Enviar pedido por WhatsApp» sugería que la web envía el mensaje; el aviso estaba *después* del botón | Alta (regla de negocio) | Corregido: «Continuar a WhatsApp», aviso antes del botón y asociado con `aria-describedby` |
| R2 | Aviso de privacidad solo al final del formulario; CLAUDE.md exige informarlo antes de recopilar datos | Alta (privacidad) | Corregido: aviso al inicio de «Tus datos» + casilla de consentimiento |
| R3 | Carrito sin acción «Eliminar» (requisito MVP) | Media | Corregido |
| R4 | Tarjetas del catálogo sin la leyenda «Precio provisional» | Media | Corregido |
| R5 | Error de teléfono sin `aria-invalid`/`aria-describedby` ni borde de error | Media (a11y) | Corregido |
| R6 | Cuadrícula de 6 columnas estrechas en escritorio | Baja | Corregido: 2 columnas en móvil, mínimo 220 px desde 640 px |
| R7 | «Agregar al carrito» era un enlace, no un botón | Baja | Corregido |
| R8 | Productos bajo pedido no indican fecha más próxima | Media | Placeholder; depende de la política de anticipación (Fase 8, CLAUDE.md §14) |
| R9 | `input type=number` para cantidad en detalle vs. botones −/+ en carrito | Baja | Unificar al selector −/+ al implementar en Fase 5 |
| R10 | «Carrito (2)» se anuncia como número suelto | Baja | Implementar como «Carrito, 2 productos» (etiqueta accesible) en Fase 5 |

**Estado de R9 y R10 (Fase 6):** R9 resuelto (selector −/+ unificado en detalle y carrito); R10 resuelto (la cabecera anuncia «Carrito, N productos»). R8 sigue pendiente de la Fase 8.

**Repostería especializada (Fase 8):** el campo de personalización aparece solo en los productos que lo admiten, con pista de ejemplo, contador de caracteres y aviso de que la tienda confirmará. En el checkout, la fecha muestra «Primera fecha disponible», explica el motivo cuando una fecha no sirve (ya pasó, falta anticipación, cerrado o sin cupo) y sugiere la siguiente; los mensajes usan `role="alert"` y texto, no solo color. En el panel, los días de la semana cerrados son casillas agrupadas en un `fieldset` con leyenda. axe WCAG A/AA sin violaciones.

**Panel de administración (Fase 7):** mismas tokens y componentes que la tienda. Navegación propia («Administración») con enlaces de 48 px, formularios con etiqueta, ayuda y error asociados (`aria-describedby`, `role="alert"`, `aria-invalid`), confirmaciones explícitas para acciones irreversibles (cancelar pedido, cambiar WhatsApp) y listas en tarjetas que funcionan sin tablas anchas en móvil. axe WCAG A/AA sin violaciones en las 9 pantallas y sin desbordamiento horizontal a 390 px y 1280 px. No se probó con lector de pantalla.

Veredicto: sistema visual **aprobado para pasar a Fase 3**, con R8–R10 registrados como pendientes de implementación.
