-- Semillas de demostración. DATOS FICTICIOS: nombres de ejemplo y precios PROVISIONALES
-- que no son precios comerciales aprobados (CLAUDE.md §4). Alérgenos sin verificar.
-- Sin imágenes: las fotos demo con licencia se añaden en la Fase 5.

insert into public.categories (slug, name, sort_order) values
  ('pasteles', 'Pasteles', 1),
  ('cupcakes', 'Cupcakes', 2),
  ('galletas', 'Galletas', 3),
  ('brownies-y-barras', 'Brownies y barras', 4),
  ('postres-individuales-y-cajas', 'Postres individuales y cajas', 5);

-- fulfillment: los pasteles y la caja surtida se tratan como bajo pedido; el resto como
-- inventario físico. Es una suposición de demo: la política real está pendiente (CLAUDE.md §14).
insert into public.products
  (category_id, sku, slug, name, description, price_cents, lead_time_hours, fulfillment_type, featured)
select c.id, v.sku, v.slug, v.name, v.description, v.price_cents, v.lead_time_hours,
       v.fulfillment::public.product_fulfillment, v.featured
  from (values
    ('pasteles', 'PAS-001', 'pastel-vainilla-buttercream', 'Pastel de vainilla con buttercream',
     'Bizcocho de vainilla con betún de mantequilla. Descripción de ejemplo.', 65000, 48, 'made_to_order', true),
    ('pasteles', 'PAS-002', 'pastel-chocolate-fudge', 'Pastel de chocolate fudge',
     'Bizcocho de chocolate con cobertura fudge. Descripción de ejemplo.', 70000, 48, 'made_to_order', true),
    ('pasteles', 'PAS-003', 'pastel-red-velvet', 'Pastel red velvet',
     'Bizcocho red velvet con betún de queso crema. Descripción de ejemplo.', 72000, 48, 'made_to_order', false),
    ('pasteles', 'PAS-004', 'pastel-tres-leches', 'Pastel de tres leches',
     'Bizcocho bañado en tres leches. Descripción de ejemplo.', 60000, 48, 'made_to_order', true),
    ('pasteles', 'PAS-005', 'cheesecake-fresa', 'Cheesecake de fresa',
     'Cheesecake horneado con cubierta de fresa. Descripción de ejemplo.', 68000, 48, 'made_to_order', false),
    ('cupcakes', 'CUP-001', 'cupcake-vainilla', 'Cupcake de vainilla',
     'Cupcake de vainilla con betún. Descripción de ejemplo.', 4500, 0, 'stock', false),
    ('cupcakes', 'CUP-002', 'cupcake-chocolate', 'Cupcake de chocolate',
     'Cupcake de chocolate con betún. Descripción de ejemplo.', 4500, 0, 'stock', true),
    ('cupcakes', 'CUP-003', 'cupcake-zanahoria', 'Cupcake de zanahoria',
     'Cupcake de zanahoria con betún de queso crema. Descripción de ejemplo.', 5000, 0, 'stock', false),
    ('cupcakes', 'CUP-004', 'cupcake-red-velvet', 'Cupcake red velvet',
     'Cupcake red velvet con betún de queso crema. Descripción de ejemplo.', 5000, 0, 'stock', false),
    ('galletas', 'GAL-001', 'galletas-chispas-chocolate', 'Galletas con chispas de chocolate',
     'Paquete de galletas con chispas de chocolate. Descripción de ejemplo.', 9000, 0, 'stock', true),
    ('galletas', 'GAL-002', 'galletas-mantequilla-decoradas', 'Galletas de mantequilla decoradas',
     'Galletas de mantequilla con decoración de ejemplo.', 12000, 24, 'stock', false),
    ('galletas', 'GAL-003', 'galletas-avena-canela', 'Galletas de avena con canela',
     'Paquete de galletas de avena con canela. Descripción de ejemplo.', 8500, 0, 'stock', false),
    ('brownies-y-barras', 'BRO-001', 'brownie-clasico', 'Brownie clásico',
     'Brownie de chocolate. Descripción de ejemplo.', 4000, 0, 'stock', false),
    ('brownies-y-barras', 'BRO-002', 'brownie-nuez', 'Brownie con nuez',
     'Brownie de chocolate con nuez. Descripción de ejemplo.', 4500, 0, 'stock', false),
    ('brownies-y-barras', 'BRO-003', 'barra-limon', 'Barra de limón',
     'Barra con base de galleta y relleno de limón. Descripción de ejemplo.', 4000, 0, 'stock', false),
    ('postres-individuales-y-cajas', 'POS-001', 'pay-queso-individual', 'Pay de queso individual',
     'Pay de queso en porción individual. Descripción de ejemplo.', 5500, 0, 'stock', false),
    ('postres-individuales-y-cajas', 'POS-002', 'mini-tiramisu', 'Mini tiramisú',
     'Tiramisú en porción individual. Descripción de ejemplo.', 6000, 0, 'stock', false),
    ('postres-individuales-y-cajas', 'POS-003', 'flan-napolitano', 'Flan napolitano',
     'Flan napolitano en porción individual. Descripción de ejemplo.', 4500, 0, 'stock', false),
    ('postres-individuales-y-cajas', 'POS-004', 'chocoflan', 'Chocoflan',
     'Chocoflan en porción individual. Descripción de ejemplo.', 5500, 0, 'stock', false),
    ('postres-individuales-y-cajas', 'POS-005', 'caja-surtida-postres', 'Caja surtida de postres',
     'Caja con surtido de postres. Descripción de ejemplo.', 35000, 24, 'made_to_order', true)
  ) as v(category_slug, sku, slug, name, description, price_cents, lead_time_hours, fulfillment, featured)
  join public.categories c on c.slug = v.category_slug;

-- Existencias iniciales de demo, registradas como movimientos auditados.
with s as (
  update public.products set stock_quantity = 12
   where fulfillment_type = 'stock'
  returning id
)
insert into public.inventory_movements (product_id, delta, reason, note)
select id, 12, 'initial', 'Existencia inicial de demostración' from s;
