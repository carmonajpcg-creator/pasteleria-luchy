# Rediseño visual de Luchy

Fecha: 21 de octubre de 2026.

## Dirección y alcance

Una vitrina de repostería: la selección de Luchy se convierte en un catálogo visual que permite elegir por antojo y confirmar por WhatsApp. Portada con mosaico de imágenes, índice de categorías con vista previa al apuntar o enfocar, productos con fotos grandes y un cierre que explica cómo pedir. Mantiene rutas, filtros en la URL, carrito, personalización y confirmación del pedido.

Inventario real: nombre Luchy, español MX, moneda MXN, cinco categorías, veinte productos de prueba, seis destacados, productos de existencia y bajo pedido, entrega/recolección, personalización y confirmación por WhatsApp. No se inventaron reseñas, historia, horarios ni credenciales comerciales.

Argumento de la portada: qué ofrece la pastelería → imágenes; cómo explorar → categorías; qué elegir → destacados; cómo pedir → proceso real; dónde resolver dudas → contacto.

## Aplicación de las skills

- Taste Skill: dirección `specimen-catalogue`, semilla `1950443662`; fotografía como protagonista, Schibsted Grotesk, vista previa de categorías, composición y revisión a 1440, 768 y 390 px.
- UI/UX Pro Max: consulta `bakery patisserie ecommerce friendly professional artisan`; acciones visibles, controles táctiles de 44–52 px, estados accesibles, contraste y jerarquía. Se adaptó la recomendación marrón/amarillo a musgo y papel para el carácter profesional y cercano del encargo.
- Awesome DESIGN.md: referencia [Starbucks](https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/starbucks), aplicada como superficies planas, verdes con roles distintos y botones redondos. Sin usar su logotipo ni fuentes propietarias.
- Web Design Guidelines: revisión de [las reglas de Vercel](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md): enlaces semánticos, controles etiquetados, foco, dimensiones de imágenes, búsqueda en URL y movimiento reducido.
- Guías de marca, tokens y estilos del AGENTS.md: primitivas → semánticos → componentes en `design/tokens.css`, consumidos por Tailwind y estilos compartidos.

Adaptaciones deliberadas de los blueprints de Taste: el mosaico acompaña al título en vez de ocultarlo en una pared de miniaturas; el proceso describe un pedido, no una fabricación sin documentar; el contacto enlaza al flujo existente en lugar de agregar un formulario sin backend. Se aclaró el fondo arena original para favorecer legibilidad. El catálogo conserva su cuadrícula funcional y los estados de disponibilidad.

## Imágenes ilustrativas

Cuatro imágenes creadas con la herramienta integrada ImageGen, sin fotos de terceros. Archivos: `public/images/luchy-cake.webp`, `luchy-cupcakes.webp`, `luchy-cookies.webp` y `luchy-brownies.webp`. Se conservaron los originales generados y se codificaron copias WebP de 1024 × 1024 (aproximadamente 384 KB en total).

Prompts utilizados: fotografía editorial de repostería, luz natural suave, objeto centrado, textura realista, fondo de estudio claro, sin texto, logotipos ni personas. Sujetos: pastel de vainilla con fresas sobre pedestal y fondo salvia; tres cupcakes de chocolate y fondo rosa; galletas con chispas de chocolate y fondo avena; brownies con nueces y fondo gris salvia.

Las imágenes se identifican como ejemplo en las páginas y en su texto alternativo. Ilustran familias de producto; no representan recetas, decoración ni alérgenos reales. Las fotos que la tienda suba a Supabase tienen prioridad automática. Antes de publicar el catálogo definitivo deben sustituirse por fotografías propias y revisarse precios y textos provisionales.

## Revisión visual

ROUND 1
Seen in one second: nombre Luchy y pastel con fresas, con acción hacia el catálogo.
Idea (one sentence): la repostería de Luchy se presenta como una vitrina navegable por antojo.
Live thing: índice de categorías con foto que cambia al apuntar o enfocar y enlaces a filtros reales.
Layout words by section: hero=mosaico / categorías=índice / destacados=catálogo / pedido=split / contacto=texto dividido / footer=marca.
Scores: design 7.5 · usability 8 · creativity 6.5 · content 6 → overall 7.4.
Caps applied: concepto transferible a otras pastelerías; fotografías y contenido comercial demostrativos.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. mobile-fold.jpg: faltaba un espacio al ocultar el salto de línea del subtítulo; corregido.
2. desktop-page-02.jpg: el estilo genérico del pie reducía el nombre de marca; corregido.
3. mobile-page-01.jpg: etiquetas y avisos pequeños; tamaño mínimo elevado a 13 px.

ROUND 2
Seen in one second: Luchy, pastelería, catálogo y productos.
Idea (one sentence): vitrina de antojos con navegación directa a categorías y pedido.
Live thing: vista previa de categorías con foco de teclado equivalente al hover, además del carrito existente.
Layout words by section: hero=mosaico / categorías=índice / destacados=catálogo / pedido=split / contacto=texto / footer=marca.
Scores: design 7.7 · usability 8.2 · creativity 6.5 · content 6 → overall 7.5.
Caps applied: creatividad limitada por el concepto de categoría; contenido limitado por las fotos de ejemplo.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. desktop-page-01.jpg: una misma imagen representa varios productos; sustituirla por fotos reales de la tienda.
2. mobile-page-01.jpg: los nombres largos ocupan más que las fichas cortas; se conservan completos.
3. desktop-page-02.jpg: faltan horarios y cobertura definitivos; se conserva la configuración real, sin inventarlos.

Inspector de portada: antes 6 fallos; después 0 fallos. Advertencias conservadas: fondo papel claro por la referencia de retail; más de cinco tamaños por precios, etiquetas y logotipo; sin vídeo porque no hay material real del negocio; movimiento contenido para facilitar la compra; nombre como título junto a la descripción de la oferta.

## Validación

- Compilación TypeScript/Vite y ESLint correctos.
- 119 pruebas unitarias correctas.
- 235 pruebas de navegador correctas; una omitida por no aplicar teclado al dispositivo táctil.
- Contraste WCAG A/AA con axe en las pantallas cubiertas por la suite. Se resolvió la transparencia inicial de entrada manteniendo el texto opaco mientras se anima su posición.
- Lectura del catálogo real: veinte productos. Recorrido producto → carrito → checkout sin enviar un pedido.
- Sin desbordamiento en catálogo, detalle, carrito, checkout y contacto a 375 y 768 px.
- Movimiento reducido: cero animaciones activas y título visible.

Capturas de revisión en `.taste-skill/` (ignoradas por Git). Configuración local sin versionar. No se cambiaron datos, políticas ni esquema de Supabase. No se hizo commit, push ni publicación del rediseño.
