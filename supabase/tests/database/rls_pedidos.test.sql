-- Pruebas pgTAP de RLS, pedidos e inventario. Ejecutar con: supabase test db
-- Todo ocurre en una transacción que se revierte al final.
begin;
create extension if not exists pgtap with schema extensions;

select plan(37);

-- Configuración neutra (sin días cerrados ni anticipación general, zona UTC como current_date): estas
-- pruebas no dependen del día de la semana ni de la hora. Las reglas de fechas y zona horaria se prueban
-- en reposteria.test.sql y revision_fase8.test.sql.
update public.store_settings set closed_weekdays = '{}', closed_dates = '{}', pickup_closed_weekdays = '{}',
  daily_capacity = null, min_lead_hours = 0, timezone = 'UTC';
set local timezone = 'UTC';

-- Fixtures (como postgres) ----------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'cliente@test.local');
insert into public.profiles (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'admin');

select is((select count(*) from public.products), 20::bigint, 'hay 20 productos semilla');
select is((select count(*) from public.categories), 5::bigint, 'hay 5 categorías semilla');

-- Anónimo ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*) from public.catalog_products), 20::bigint, 'anon ve el catálogo público');
select throws_ok('select * from public.products', '42501', null, 'anon no lee products directamente');
select throws_ok('select * from public.orders', '42501', null, 'anon no lee pedidos');
select throws_ok('select * from public.payments', '42501', null, 'anon no lee pagos');
select throws_ok($$update public.categories set name = 'x'$$, '42501', null, 'anon no edita categorías');
select lives_ok('select store_name, whatsapp_number from public.store_settings', 'anon lee la configuración pública');
select throws_ok('select order_expiry_hours from public.store_settings', '42501', null, 'anon no lee parámetros internos');

select ok(
  (select set_config('test.folio', r.folio, false) || set_config('test.token', r.public_token, false)
     from public.create_order(
       '11111111-1111-1111-1111-111111111111', 'Cliente Prueba', '5500000000', null, 'pickup',
       current_date + 3, null, true,
       jsonb_build_array(
         jsonb_build_object('product_id', (select id from public.catalog_products where sku = 'CUP-001'), 'quantity', 2),
         jsonb_build_object('product_id', (select id from public.catalog_products where sku = 'PAS-001'), 'quantity', 1)
       )) r) is not null,
  'anon crea un pedido');

select is(
  (public.get_order_public(current_setting('test.folio'), current_setting('test.token'))->>'total_cents')::int,
  2 * 4500 + 65000,
  'el total se calcula en la BD');
select is(
  public.get_order_public(current_setting('test.folio'), current_setting('test.token'))->>'status',
  'pending_contact',
  'el pedido nace pendiente de contacto');
select ok(
  public.get_order_public(current_setting('test.folio'), 'token-incorrecto') is null,
  'un token incorrecto no revela el pedido');
select is(
  (select r.folio from public.create_order(
     '11111111-1111-1111-1111-111111111111', 'Otro', '5511111111', null, 'delivery',
     current_date + 5, null, true,
     jsonb_build_array(jsonb_build_object('product_id', (select id from public.catalog_products where sku = 'BRO-001'), 'quantity', 1))
   ) r),
  current_setting('test.folio'),
  'la misma clave de idempotencia devuelve el mismo pedido');

select throws_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5500000000', null, 'pickup',
          current_date + 3, null, false, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1)))$$,
         (select id from public.catalog_products where sku = 'CUP-001')),
  '22023', null, 'sin aceptar privacidad se rechaza');
select throws_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5500000000', null, 'pickup',
          current_date - 1, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1)))$$,
         (select id from public.catalog_products where sku = 'CUP-001')),
  '22023', null, 'una fecha pasada se rechaza');
select throws_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5500000000', null, 'pickup',
          current_date + 1, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1)))$$,
         (select id from public.catalog_products where sku = 'PAS-002')),
  '22023', null, 'una fecha menor a la anticipación del producto se rechaza');
select throws_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5500000000', null, 'pickup',
          current_date + 3, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 0)))$$,
         (select id from public.catalog_products where sku = 'CUP-001')),
  '22023', null, 'cantidad cero se rechaza');
select throws_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5500000000', null, 'pickup',
          current_date + 3, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 13)))$$,
         (select id from public.catalog_products where sku = 'CUP-002')),
  '22023', null, 'más unidades que existencias se rechaza');
select throws_ok(
  $$select public.confirm_order('00000000-0000-0000-0000-000000000000')$$,
  '42501', null, 'anon no puede confirmar pedidos');

-- Usuario autenticado sin rol -------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.profiles (user_id, role) values ('00000000-0000-0000-0000-0000000000b1', 'admin')$$,
  '42501', null, 'un usuario no puede autoasignarse admin');
select is((select count(*) from public.orders), 0::bigint, 'un no admin no ve pedidos');
select is_empty($$update public.products set price_cents = 1 returning id$$, 'un no admin no cambia precios');
select throws_ok(
  $$select public.confirm_order('00000000-0000-0000-0000-000000000000')$$,
  '42501', null, 'un no admin no puede confirmar pedidos');

-- Administrador ---------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select ok(
  (select set_config('test.order_id', id::text, false) from public.orders
    where folio = current_setting('test.folio')) is not null,
  'el admin ve el pedido');
select throws_ok($$update public.products set stock_quantity = 99$$, '42501', null,
  'el stock no se edita directamente');

select is(public.confirm_order(current_setting('test.order_id')::uuid)::text, 'confirmed', 'el admin confirma');
select is((select stock_quantity from public.products where sku = 'CUP-001'), 10, 'confirmar descuenta stock');
select is(public.confirm_order(current_setting('test.order_id')::uuid)::text, 'confirmed', 'confirmar de nuevo es inocuo');
select is((select stock_quantity from public.products where sku = 'CUP-001'), 10, 'sin doble descuento');
select is(
  (select count(*) from public.inventory_movements
    where order_id = current_setting('test.order_id')::uuid and reason = 'order_confirmed'),
  1::bigint, 'un solo movimiento de stock (el pastel es bajo pedido)');

select lives_ok(
  format($$insert into public.payments (order_id, amount_cents, method) values (%L, 20000, 'cash')$$,
         current_setting('test.order_id')),
  'el admin registra un anticipo');
select is(
  (select payment_status::text from public.orders where id = current_setting('test.order_id')::uuid),
  'partial', 'el anticipo deja el pago parcial');
select throws_ok($$update public.payments set amount_cents = 1$$, '42501', null, 'los pagos no se editan');

select is(public.cancel_order(current_setting('test.order_id')::uuid, 'Prueba de reversión')::text,
  'cancelled', 'el admin cancela');
select is((select stock_quantity from public.products where sku = 'CUP-001'), 12, 'cancelar repone stock');
select throws_ok(
  format($$select public.advance_order(%L, 'in_preparation')$$, current_setting('test.order_id')),
  '22023', null, 'un pedido cancelado no avanza');

select * from finish();
rollback;
