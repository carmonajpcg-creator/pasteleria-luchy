-- Reporte de ventas por periodo (solo administradores). Las fechas se interpretan en la zona horaria de la tienda.
-- Una venta cuenta en el día en que la tienda la confirmó (confirmed_at) y mientras no se cancele.

create function public.admin_sales_report(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
begin
  perform public.require_admin();
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Rango de fechas inválido' using errcode = '22023';
  end if;
  if p_to - p_from > 366 then
    raise exception 'El rango máximo es de un año' using errcode = '22023';
  end if;

  select timezone into v_tz from public.store_settings limit 1;
  v_tz := coalesce(v_tz, 'UTC');
  v_start := p_from::timestamp at time zone v_tz;
  v_end := (p_to + 1)::timestamp at time zone v_tz;

  return (
    with sold as (
      select o.id, o.total_cents, (o.confirmed_at at time zone v_tz)::date as day
        from public.orders o
       where o.status in ('confirmed', 'in_preparation', 'ready', 'delivered')
         and o.confirmed_at >= v_start and o.confirmed_at < v_end
    ),
    days as (
      select day, count(*)::int as orders, sum(total_cents)::bigint as sales_cents
        from sold group by day
    ),
    products as (
      select i.sku, i.name, sum(i.quantity)::int as quantity, sum(i.line_total_cents)::bigint as total_cents
        from public.order_items i join sold s on s.id = i.order_id
       group by i.sku, i.name
    )
    select jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'orders', (select count(*)::int from sold),
      'sales_cents', (select coalesce(sum(total_cents), 0)::bigint from sold),
      'cancelled', (select count(*)::int from public.orders
                     where status = 'cancelled' and cancelled_at >= v_start and cancelled_at < v_end),
      'paid_cents', (select coalesce(sum(case when is_refund then -amount_cents else amount_cents end), 0)::bigint
                       from public.payments where paid_at >= v_start and paid_at < v_end),
      'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'orders', orders, 'sales_cents', sales_cents)
                                           order by day), '[]'::jsonb) from days),
      'by_product', (select coalesce(jsonb_agg(jsonb_build_object('sku', sku, 'name', name, 'quantity', quantity,
                                                                  'total_cents', total_cents)
                                               order by quantity desc, name), '[]'::jsonb) from products)
    )
  );
end;
$$;

revoke all on function public.admin_sales_report(date, date) from public, anon, authenticated;
grant execute on function public.admin_sales_report(date, date) to authenticated;
