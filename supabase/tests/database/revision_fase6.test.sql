-- Revisión Opus de la Fase 6: antispam normalizado, teléfono mínimo, zona horaria pública y caducidad.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select lives_ok('select timezone from public.store_settings', 'anon lee la zona horaria de la tienda');
select throws_ok('select order_expiry_hours from public.store_settings', '42501', null,
  'anon sigue sin leer parámetros internos');

select throws_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Cliente', '--------', null, 'pickup',
          current_date + 3, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1)))$$,
         (select id from public.catalog_products where sku = 'CUP-001')),
  '22023', null, 'un teléfono sin 8 dígitos se rechaza en el servidor');

-- Cinco pedidos con el mismo número escrito de tres formas distintas.
select lives_ok($q$
  do $d$
  begin
    for i in 1..5 loop
      perform public.create_order(
        gen_random_uuid(), 'Spam', (array['55 1111 2222', '5511112222', '(55) 1111-2222'])[1 + i % 3],
        null, 'pickup', current_date + 3, null, true,
        jsonb_build_array(jsonb_build_object(
          'product_id', (select id from public.catalog_products where sku = 'CUP-001'), 'quantity', 1)));
    end loop;
  end
  $d$
$q$, 'se crean 5 pedidos con variantes del mismo teléfono');

select throws_ok(
  format($$select * from public.create_order(gen_random_uuid(), 'Spam', '55-1111-2222', null, 'pickup',
          current_date + 3, null, true, jsonb_build_array(jsonb_build_object('product_id', %L::uuid, 'quantity', 1)))$$,
         (select id from public.catalog_products where sku = 'CUP-001')),
  '54000', null, 'el sexto pedido con el mismo número (otro formato) se bloquea');

reset role;

-- Caducidad: los pendientes vencidos se cancelan sin tocar stock.
update public.orders set expires_at = now() - interval '1 minute' where customer_name = 'Spam';
select ok(public.expire_pending_orders() >= 5, 'expire_pending_orders cancela los pendientes vencidos');

select isnt_empty(
  $$select 1 from cron.job where jobname = 'luchy-expire-pending-orders' and command like '%expire_pending_orders%'$$,
  'la caducidad está programada en pg_cron');

select * from finish();
rollback;
