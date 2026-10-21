-- Fase 9: límite de solicitudes por IP en las funciones públicas.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

update public.store_settings set closed_weekdays = '{}', closed_dates = '{}', pickup_closed_weekdays = '{}',
  daily_capacity = null, min_lead_hours = 0, timezone = 'UTC';
set local timezone = 'UTC';

select ok(not has_schema_privilege('anon', 'private', 'usage') and not has_schema_privilege('authenticated', 'private', 'usage'),
  'el esquema private no es accesible desde la API');
select ok(not has_function_privilege('anon', 'public.create_order_impl(uuid, text, text, text, public.fulfillment_mode, date, text, boolean, jsonb)', 'execute'),
  'la implementación de create_order no se puede llamar saltándose el límite');

-- Sin cabeceras HTTP (conexión directa) no hay límite.
select is(private.client_key(), null, 'sin cabeceras no hay clave de cliente');

-- IP de la cabecera de Cloudflare; x-forwarded-for solo cuenta su última entrada.
select set_config('request.headers', '{"cf-connecting-ip":"198.51.100.1","x-forwarded-for":"203.0.113.9, 198.51.100.1"}', true);
select set_config('t.k1', private.client_key(), true);
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.9, 198.51.100.1"}', true);
select is(private.client_key(), current_setting('t.k1'),
  'sin cf-connecting-ip se usa la última entrada de x-forwarded-for (no la que antepone el cliente)');
select set_config('request.headers', '{"x-forwarded-for":"198.51.100.1, 198.51.100.2"}', true);
select isnt(private.client_key(), current_setting('t.k1'), 'otra IP final produce otra clave');
select ok(current_setting('t.k1') !~ '198\.51', 'la IP se guarda como hash, no en claro');

-- get_availability: 60 por 10 minutos por IP.
select set_config('request.headers', '{"cf-connecting-ip":"198.51.100.20"}', true);
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
-- Cada fila llama a la función (el argumento depende de g; sin eso Postgres la evaluaría una sola vez).
select lives_ok($$select count(*) from generate_series(1, 60) g, lateral public.get_availability(current_date, current_date, g - g) a$$,
  '60 consultas de disponibilidad desde una IP se aceptan');
select throws_ok($$select * from public.get_availability(current_date, current_date)$$, '54000',
  'Demasiadas solicitudes; espera unos minutos e inténtalo de nuevo', 'la consulta 61 se rechaza');
select set_config('request.headers', '{"cf-connecting-ip":"198.51.100.21"}', true);
select lives_ok($$select * from public.get_availability(current_date, current_date)$$, 'otra IP no está afectada');

-- create_order: 10 por hora por IP; un reintento idempotente nunca se bloquea.
select set_config('request.headers', '{"cf-connecting-ip":"198.51.100.30"}', true);
select set_config('t.key0', gen_random_uuid()::text, true);
select lives_ok($q$
  do $d$
  begin
    for i in 1..10 loop
      perform public.create_order(
        case when i = 1 then current_setting('t.key0')::uuid else gen_random_uuid() end,
        'Cliente', '55100000' || lpad(i::text, 2, '0'), null, 'delivery', current_date + 5, null, true,
        jsonb_build_array(jsonb_build_object('product_id', (select id from public.catalog_products where sku = 'CUP-001'), 'quantity', 1)));
    end loop;
  end
  $d$
$q$, '10 pedidos desde una IP se aceptan');
select throws_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '5510000099', null, 'delivery',
          current_date + 5, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1)))$$,
         (select id from public.catalog_products where sku = 'CUP-001')),
  '54000', null, 'el pedido 11 de la misma IP se rechaza');
select ok(
  (select count(*) = 1 from public.create_order(current_setting('t.key0')::uuid, 'Cliente', '5510000001', null, 'delivery',
     current_date + 5, null, true, jsonb_build_array(jsonb_build_object('product_id',
     (select id from public.catalog_products where sku = 'CUP-001'), 'quantity', 1)))),
  'el reintento con la misma clave devuelve su pedido aunque la IP esté limitada');

-- get_order_public: también limitado (60 por 10 minutos).
select set_config('request.headers', '{"cf-connecting-ip":"198.51.100.40"}', true);
select throws_ok($$select count(*) from generate_series(1, 61) g, lateral (select public.get_order_public('L-NOEXISTE' || g, 'x')) x$$,
  '54000', null, 'más de 60 consultas de seguimiento desde una IP se rechazan');

select * from finish();
rollback;
