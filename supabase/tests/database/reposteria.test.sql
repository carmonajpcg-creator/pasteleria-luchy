-- Fase 8: personalización, días cerrados, anticipación general y capacidad diaria.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local');
insert into public.profiles (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'admin');

-- Fechas relativas a la zona de la tienda (el servidor las evalúa igual).
select set_config('t.today', ((now() at time zone (select timezone from public.store_settings))::date)::text, true);
select set_config('t.d5', (current_setting('t.today')::date + 5)::text, true);
select set_config('t.d6', (current_setting('t.today')::date + 6)::text, true);

-- Pastel (bajo pedido, 48 h) con personalización; cupcake (stock) sin personalización.
update public.products set allows_customization = true, customization_hint = 'Texto en el pastel' where sku = 'PAS-001';

-- Anónimo: catálogo con las columnas nuevas ------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select allows_customization from public.catalog_products where sku = 'PAS-001'), true,
  'la vista pública expone allows_customization');
select is((select customization_hint from public.catalog_products where sku = 'PAS-001'), 'Texto en el pastel',
  'la vista pública expone la pista de personalización');
select is((select allows_customization from public.catalog_products where sku = 'CUP-001'), false,
  'por defecto un producto no admite personalización');
select throws_ok('select closed_dates from public.store_settings', '42501', null,
  'anon no lee la configuración de días cerrados (usa get_availability)');

select throws_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5500000000', null, 'pickup',
          %L::date, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1,
          'customization', 'Feliz cumpleaños')))$$,
         current_setting('t.d5'), (select id from public.catalog_products where sku = 'CUP-001')),
  '22023', 'Un producto del carrito no admite personalización', 'personalizar un producto que no lo admite se rechaza');
select lives_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5500000001', null, 'pickup',
          %L::date, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1,
          'customization', 'Feliz cumpleaños Ana')))$$,
         current_setting('t.d5'), (select id from public.catalog_products where sku = 'PAS-001')),
  'personalizar un producto que sí lo admite funciona');

-- Disponibilidad pública -----------------------------------------------------------------
select is((select reason from public.get_availability(current_setting('t.today')::date, current_setting('t.today')::date + 10, 48) where day = current_setting('t.today')::date),
  'lead', 'hoy no hay anticipación suficiente para un producto de 48 h');
select is((select available from public.get_availability(current_setting('t.d5')::date, current_setting('t.d5')::date, 48)),
  true, 'dentro de la anticipación y sin restricciones está disponible');
select throws_ok($$select * from public.get_availability(current_date, current_date + 200)$$, '22023', null,
  'el rango máximo es de 120 días');

-- Administrador: reglas de la tienda --------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok(
  format($$update public.store_settings set closed_dates = array[%L::date], closed_weekdays = '{}', daily_capacity = null$$,
         current_setting('t.d6')),
  'el admin define una fecha cerrada');
select throws_ok($$update public.store_settings set closed_weekdays = '{0,1,2,3,4,5,6}'$$, '23514', null,
  'no se pueden cerrar los 7 días de la semana');
select throws_ok($$update public.store_settings set closed_weekdays = '{9}'$$, '23514', null,
  'los días de la semana van de 0 a 6');
select throws_ok($$update public.store_settings set daily_capacity = 0$$, '23514', null, 'la capacidad mínima es 1');
select throws_ok($$update public.store_settings set min_lead_hours = 9999$$, '23514', null, 'la anticipación general tiene tope');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select reason from public.get_availability(current_setting('t.d6')::date, current_setting('t.d6')::date, 0)),
  'closed', 'la fecha cerrada aparece como cerrada');
select throws_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5500000002', null, 'pickup',
          %L::date, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1)))$$,
         current_setting('t.d6'), (select id from public.catalog_products where sku = 'CUP-001')),
  '22023', 'La tienda no recibe pedidos para esa fecha; elige otra', 'no se puede pedir para una fecha cerrada');

-- Capacidad diaria -------------------------------------------------------------------------
reset role;
update public.store_settings set closed_dates = '{}', daily_capacity = 1;
select is(public.capacity_used(current_setting('t.d5')::date), 1, 'el pedido personalizado ocupa un lugar ese día');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select reason from public.get_availability(current_setting('t.d5')::date, current_setting('t.d5')::date, 48)),
  'full', 'con capacidad 1 y un pedido, el día aparece lleno');
select throws_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5500000003', null, 'pickup',
          %L::date, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1)))$$,
         current_setting('t.d5'), (select id from public.catalog_products where sku = 'PAS-002')),
  '22023', 'Ya no hay cupo para esa fecha; elige otra', 'un segundo pedido bajo pedido en un día lleno se rechaza');
select lives_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5500000004', null, 'pickup',
          %L::date, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1)))$$,
         current_setting('t.d5'), (select id from public.catalog_products where sku = 'CUP-001')),
  'un pedido solo de existencia no consume cupo y sí se acepta');

-- Cancelar libera el cupo ----------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((public.admin_capacity(7)->>'capacity')::int, 1, 'admin_capacity devuelve la capacidad configurada');
select ok((select (d->>'orders')::int from jsonb_array_elements(public.admin_capacity(10)->'days') d
            where d->>'day' = current_setting('t.d5')) = 1, 'admin_capacity cuenta los pedidos del día');
select ok((select public.cancel_order(id, 'Libera cupo') = 'cancelled'
             from public.orders where customer_phone = '5500000001'), 'el admin cancela el pedido que ocupaba el cupo');
select ok((select bool_and(jsonb_typeof(d->'closed') = 'boolean') from jsonb_array_elements(public.admin_capacity(7)->'days') d),
  'admin_capacity siempre devuelve closed como booleano (nunca null)');
select throws_ok($$select public.capacity_used(current_date)$$, '42501', null,
  'capacity_used es interna: ni el admin la ejecuta directamente');
reset role;
select is(public.capacity_used(current_setting('t.d5')::date), 0, 'cancelar libera el cupo');

select * from finish();
rollback;
