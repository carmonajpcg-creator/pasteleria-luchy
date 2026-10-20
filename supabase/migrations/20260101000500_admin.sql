-- Fase 7: datos agregados del panel en una sola llamada. Solo administradores.

create function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'orders_by_status', (
      select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
        from (select status::text as status, count(*)::int as n from public.orders group by status) s
    ),
    -- Ventas confirmadas: pedidos que la tienda ya confirmó y no se cancelaron.
    'confirmed_sales_cents', (
      select coalesce(sum(total_cents), 0)::bigint from public.orders
       where status in ('confirmed', 'in_preparation', 'ready', 'delivered')
    ),
    -- Dinero registrado manualmente (anticipos y pagos menos reembolsos).
    'paid_cents', (
      select coalesce(sum(case when is_refund then -amount_cents else amount_cents end), 0)::bigint
        from public.payments
    ),
    'low_stock', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'sku', p.sku, 'name', p.name,
               'stock_quantity', p.stock_quantity, 'low_stock_threshold', p.low_stock_threshold
             ) order by p.stock_quantity, p.name), '[]'::jsonb)
        from public.products p
       where p.active and p.fulfillment_type = 'stock' and p.stock_quantity <= p.low_stock_threshold
    )
  );
end;
$$;

revoke all on function public.admin_dashboard() from public, anon, authenticated;
grant execute on function public.admin_dashboard() to authenticated;
