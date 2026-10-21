-- Revisión Opus de la Fase 8: decisiones del negocio, cierre de recolección por día y cupo de un día.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local');
insert into public.profiles (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'admin');

-- Política decidida por la tienda (la deja la migración; esta prueba no la cambia antes de leerla).
select is((select pickup_closed_weekdays from public.store_settings), '{0}'::smallint[],
  'los domingos no hay recolección en tienda');
select is((select closed_weekdays from public.store_settings), '{}'::smallint[],
  'los domingos sí hay pedidos (para entrega a domicilio)');
select is((select min_lead_hours from public.store_settings), 24, 'anticipación general de 24 horas');

-- El próximo domingo con al menos 3 días de margen (en la zona de la tienda).
select set_config('t.today', ((now() at time zone (select timezone from public.store_settings))::date)::text, true);
select set_config('t.sunday', (
  current_setting('t.today')::date + 3 + ((7 - extract(dow from current_setting('t.today')::date + 3)::int) % 7)
)::text, true);
select set_config('t.monday', (current_setting('t.sunday')::date + 1)::text, true);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select reason from public.get_availability(current_setting('t.sunday')::date, current_setting('t.sunday')::date, 0, false, 'pickup')),
  'pickup_closed', 'el domingo aparece sin recolección para quien recoge');
select is(
  (select available from public.get_availability(current_setting('t.sunday')::date, current_setting('t.sunday')::date, 0, false, 'delivery')),
  true, 'el domingo sí está disponible para entrega a domicilio');
select is(
  (select available from public.get_availability(current_setting('t.monday')::date, current_setting('t.monday')::date, 0, false, 'pickup')),
  true, 'el lunes hay recolección');
select is(
  (select reason from public.get_availability(current_setting('t.today')::date, current_setting('t.today')::date, 0, false, 'delivery')),
  'lead', 'hoy no cumple las 24 h de anticipación general');

select throws_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5500000101', null, 'pickup',
          %L::date, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1)))$$,
         current_setting('t.sunday'), (select id from public.catalog_products where sku = 'CUP-001')),
  '22023', 'Ese día no hay recolección en tienda; elige entrega a domicilio u otra fecha',
  'un pedido de recolección en domingo se rechaza con un mensaje que ofrece la alternativa');
select lives_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5500000102', null, 'delivery',
          %L::date, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1)))$$,
         current_setting('t.sunday'), (select id from public.catalog_products where sku = 'CUP-001')),
  'un pedido de entrega a domicilio en domingo se acepta');
select throws_ok(
  format($$select public.admin_day_capacity(%L::date)$$, current_setting('t.sunday')),
  '42501', null, 'anon no consulta el cupo de un día');

-- Administrador -------------------------------------------------------------------------------
reset role;
update public.store_settings set daily_capacity = 3;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is(public.admin_day_capacity(current_setting('t.sunday')::date)->>'capacity', '3',
  'admin_day_capacity devuelve la capacidad');
select is((public.admin_day_capacity(current_setting('t.sunday')::date)->>'orders')::int, 0,
  'un pedido solo de existencia no cuenta para el cupo');
select is(
  (select (d->>'pickup_closed')::boolean from jsonb_array_elements(public.admin_capacity(14)->'days') d
    where extract(dow from (d->>'day')::date) = 0 limit 1),
  true, 'admin_capacity marca los domingos sin recolección');
select ok((select bool_and(jsonb_typeof(d->'pickup_closed') = 'boolean') from jsonb_array_elements(public.admin_capacity(14)->'days') d),
  'pickup_closed siempre es booleano');

select * from finish();
rollback;
