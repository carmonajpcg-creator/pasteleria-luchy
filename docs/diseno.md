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
- **No realizado:** auditoría automatizada con axe, lector de pantalla, línea base de regresión visual versionada (Playwright no forma parte aún del proyecto; se instala en la Fase 3) y revisión Opus del diseño.
