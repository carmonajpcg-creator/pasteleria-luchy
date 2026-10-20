-- Fase 7: permisos del panel (anónimo, usuario sin rol, admin), dashboard, pagos y stock.
begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'sinrol@test.local');
insert into public.profiles (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'admin');

-- Un pedido de cada tipo para las comprobaciones (como postgres).
insert into public.orders (id, folio, idempotency_key, customer_name, customer_phone, fulfillment,
                           requested_date, privacy_accepted_at, total_cents, expires_at)
values ('11111111-0000-0000-0000-000000000001', 'L-ADMIN01', gen_random_uuid(), 'Cliente Admin', '5500000001',
        'pickup', current_date + 5, now(), 10000, now() + interval '2 days');
insert into public.order_items (order_id, product_id, sku, name, unit_price_cents, quantity)
select '11111111-0000-0000-0000-000000000001', id, sku, name, price_cents, 2
  from public.products where sku = 'CUP-001';

-- Anónimo ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok('select public.admin_dashboard()', '42501', null, 'anon no ejecuta admin_dashboard');
select throws_ok('select * from public.profiles', '42501', null, 'anon no lee profiles');
select throws_ok('select * from public.inventory_movements', '42501', null, 'anon no lee movimientos');
select throws_ok('select * from public.order_items', '42501', null, 'anon no lee líneas de pedido');

-- Usuario autenticado sin rol ---------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select throws_ok('select public.admin_dashboard()', '42501', null, 'sin rol no ejecuta admin_dashboard');
select is((select count(*) from public.orders), 0::bigint, 'sin rol no ve pedidos');
select is((select count(*) from public.payments), 0::bigint, 'sin rol no ve pagos');
select is((select count(*) from public.inventory_movements), 0::bigint, 'sin rol no ve movimientos');
select is((select count(*) from public.products), 0::bigint, 'sin rol no lee la tabla products (solo la vista pública)');
select is((select count(*) from public.profiles), 0::bigint, 'sin rol no ve perfiles');
select throws_ok(
  $$insert into public.payments (order_id, amount_cents, method)
    values ('11111111-0000-0000-0000-000000000001', 100, 'cash')$$,
  '42501', null, 'sin rol no registra pagos');
select throws_ok($$insert into public.categories (slug, name) values ('x', 'X')$$, '42501', null,
  'sin rol no crea categorías');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('product-images', 'x.png')$$,
  '42501', null, 'sin rol no sube imágenes');
select is_empty($$update public.store_settings set whatsapp_number = '521' returning id$$,
  'sin rol no cambia la configuración (RLS deja 0 filas)');
select throws_ok($$select public.adjust_stock((select id from public.products limit 1), 5, 'adjustment', null)$$,
  '42501', null, 'sin rol no ajusta inventario');

-- Administrador ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select ok((select public.admin_dashboard()->'orders_by_status'->>'pending_contact')::int >= 1,
  'admin ve el pedido pendiente en el dashboard');
select is((select public.admin_dashboard()->>'confirmed_sales_cents')::bigint, 0::bigint,
  'sin pedidos confirmados, ventas confirmadas = 0');

select is(public.confirm_order('11111111-0000-0000-0000-000000000001')::text, 'confirmed', 'admin confirma');
select is((select public.admin_dashboard()->>'confirmed_sales_cents')::bigint, 10000::bigint,
  'las ventas confirmadas suman el pedido');

select lives_ok($$insert into public.payments (order_id, amount_cents, method, note)
  values ('11111111-0000-0000-0000-000000000001', 4000, 'transfer', 'anticipo')$$, 'admin registra anticipo');
select is((select payment_status::text from public.orders where id = '11111111-0000-0000-0000-000000000001'),
  'partial', 'anticipo → parcial');
select is((select public.admin_dashboard()->>'paid_cents')::bigint, 4000::bigint, 'el dashboard suma lo pagado');

select lives_ok($$insert into public.payments (order_id, amount_cents, method)
  values ('11111111-0000-0000-0000-000000000001', 6000, 'cash')$$, 'admin registra el resto');
select is((select payment_status::text from public.orders where id = '11111111-0000-0000-0000-000000000001'),
  'paid', 'pago completo → pagado');

select throws_ok($$insert into public.payments (order_id, amount_cents, method, is_refund)
  values ('11111111-0000-0000-0000-000000000001', 20000, 'cash', true)$$,
  'P0001', null, 'un reembolso mayor a lo pagado se rechaza');
select throws_ok($$insert into public.payments (order_id, amount_cents, method)
  values ('11111111-0000-0000-0000-000000000001', 0, 'cash')$$,
  '23514', null, 'un pago de cero se rechaza');
select throws_ok($$delete from public.payments$$, '42501', null, 'los pagos no se borran');

select throws_ok($$update public.products set stock_quantity = 999$$, '42501', null,
  'el stock no se escribe directo ni siendo admin');
select is(public.adjust_stock((select id from public.products where sku = 'CUP-002'), 5, 'production', 'lote')::int,
  17, 'adjust_stock suma y devuelve la nueva existencia');
select throws_ok($$select public.adjust_stock((select id from public.products where sku = 'CUP-002'), -100, 'waste', null)$$,
  '23514', null, 'no se puede dejar el stock en negativo');

select ok(jsonb_array_length(public.admin_dashboard()->'low_stock') >= 0, 'dashboard devuelve lista de stock bajo');

select is(public.cancel_order('11111111-0000-0000-0000-000000000001', 'Prueba admin')::text, 'cancelled', 'admin cancela');
select is((select public.admin_dashboard()->>'confirmed_sales_cents')::bigint, 0::bigint,
  'cancelar quita el pedido de las ventas confirmadas');

select * from finish();
rollback;
