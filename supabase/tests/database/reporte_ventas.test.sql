-- Reporte de ventas: permisos, cálculo por periodo y validaciones.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'sinrol@test.local');
insert into public.profiles (user_id, role) values ('00000000-0000-0000-0000-0000000000a1', 'admin');
update public.store_settings set timezone = 'America/Matamoros';

-- Tres pedidos: confirmado dentro del periodo, confirmado fuera, y cancelado dentro.
insert into public.orders (id, folio, idempotency_key, status, customer_name, customer_phone, fulfillment,
                           requested_date, privacy_accepted_at, total_cents, expires_at, confirmed_at, cancelled_at)
values
  ('11111111-0000-0000-0000-0000000000a1', 'L-REP0001', gen_random_uuid(), 'delivered', 'Cliente Uno', '5500000001',
   'pickup', current_date + 5, now(), 10000, now() + interval '2 days', '2026-03-10 18:00:00+00', null),
  ('11111111-0000-0000-0000-0000000000a2', 'L-REP0002', gen_random_uuid(), 'confirmed', 'Cliente Dos', '5500000002',
   'pickup', current_date + 5, now(), 5000, now() + interval '2 days', '2026-04-20 18:00:00+00', null),
  ('11111111-0000-0000-0000-0000000000a3', 'L-REP0003', gen_random_uuid(), 'cancelled', 'Cliente Tres', '5500000003',
   'pickup', current_date + 5, now(), 7000, now() + interval '2 days', '2026-03-11 18:00:00+00', '2026-03-12 18:00:00+00');
insert into public.order_items (order_id, product_id, sku, name, unit_price_cents, quantity)
select '11111111-0000-0000-0000-0000000000a1', id, sku, name, 5000, 2 from public.products where sku = 'CUP-001';
insert into public.payments (order_id, amount_cents, is_refund, method, recorded_by, paid_at)
values ('11111111-0000-0000-0000-0000000000a1', 4000, false, 'cash', '00000000-0000-0000-0000-0000000000a1', '2026-03-10 19:00:00+00'),
       ('11111111-0000-0000-0000-0000000000a1', 1000, true, 'cash', '00000000-0000-0000-0000-0000000000a1', '2026-03-11 19:00:00+00');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.admin_sales_report('2026-03-01', '2026-03-31')$$, '42501', null, 'anon no ejecuta el reporte');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select public.admin_sales_report('2026-03-01', '2026-03-31')$$, '42501', null, 'sin rol no ejecuta el reporte');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is((public.admin_sales_report('2026-03-01', '2026-03-31')->>'orders')::int, 1, 'cuenta solo ventas confirmadas del periodo');
select is((public.admin_sales_report('2026-03-01', '2026-03-31')->>'sales_cents')::int, 10000, 'suma el total de las ventas');
select is((public.admin_sales_report('2026-03-01', '2026-03-31')->>'cancelled')::int, 1, 'cuenta los cancelados del periodo');
select is((public.admin_sales_report('2026-03-01', '2026-03-31')->>'paid_cents')::int, 3000, 'pagos netos de reembolsos');
select is((public.admin_sales_report('2026-03-01', '2026-03-31')->'by_product'->0->>'quantity')::int, 2, 'unidades por producto');
select is(jsonb_array_length(public.admin_sales_report('2026-03-01', '2026-03-31')->'by_day'), 1, 'un día con ventas');
select is((public.admin_sales_report('2026-04-01', '2026-04-30')->>'sales_cents')::int, 5000, 'otro periodo suma lo suyo');
select throws_ok($$select public.admin_sales_report('2026-03-31', '2026-03-01')$$, '22023', null, 'rechaza rango invertido');
select throws_ok($$select public.admin_sales_report('2020-01-01', '2026-03-01')$$, '22023', null, 'rechaza más de un año');

select * from finish();
rollback;
