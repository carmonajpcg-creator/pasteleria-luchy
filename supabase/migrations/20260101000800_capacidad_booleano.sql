-- Fase 8: admin_capacity devolvía "closed": null en los días abiertos (null = 'closed' es nulo en SQL).
-- El contrato es un booleano.

create or replace function public.admin_capacity(p_days integer default 14) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.store_settings;
  v_today date;
begin
  perform public.require_admin();
  select * into s from public.store_settings where id;
  v_today := (now() at time zone s.timezone)::date;
  return jsonb_build_object(
    'capacity', s.daily_capacity,
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', d::date,
               'orders', public.capacity_used(d::date),
               'closed', coalesce(public.day_block_reason(d::date, false) = 'closed', false)
             ) order by d), '[]'::jsonb)
        from generate_series(v_today, v_today + greatest(1, least(coalesce(p_days, 14), 60)) - 1, interval '1 day') d
    )
  );
end;
$$;
