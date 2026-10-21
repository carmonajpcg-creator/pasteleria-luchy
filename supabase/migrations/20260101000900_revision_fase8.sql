-- Revisión Opus de la Fase 8 y decisiones del negocio (2026-10-20).
-- H1: tras tomar el bloqueo por fecha, create_order vuelve a buscar la clave de idempotencia; antes,
--     un doble envío del mismo pedido por el último cupo devolvía «Ya no hay cupo» al gemelo.
-- H2: cierres por modalidad: los domingos no hay recolección en tienda, pero sí entrega a domicilio.
-- H3: confirmar un pendiente ya caducado avisa al admin si el día ya no tiene cupo (ver UI).
-- Decisión del negocio: anticipación general de 24 h; capacidad = pedidos con productos bajo pedido;
-- los pendientes reservan cupo hasta caducar (ya era así).

alter table public.store_settings
  add column pickup_closed_weekdays smallint[] not null default '{}'
    check (pickup_closed_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

grant update (pickup_closed_weekdays) on public.store_settings to authenticated;

-- Valores decididos por la tienda. Editables desde el panel.
update public.store_settings set pickup_closed_weekdays = '{0}', min_lead_hours = 24;

-- day_block_reason ahora conoce la modalidad. 'closed' = no hay pedidos; 'pickup_closed' = ese día
-- solo hay entrega a domicilio; 'full' = sin cupo. Nulo = disponible.
drop function public.day_block_reason(date, boolean);
create function public.day_block_reason(
  p_day date, p_made_to_order boolean, p_fulfillment public.fulfillment_mode default null
) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.store_settings;
  v_dow smallint := extract(dow from p_day)::smallint;
begin
  select * into s from public.store_settings where id;
  if v_dow = any (s.closed_weekdays) or p_day = any (s.closed_dates) then
    return 'closed';
  end if;
  if p_fulfillment = 'pickup' and v_dow = any (s.pickup_closed_weekdays) then
    return 'pickup_closed';
  end if;
  if p_made_to_order and s.daily_capacity is not null and public.capacity_used(p_day) >= s.daily_capacity then
    return 'full';
  end if;
  return null;
end;
$$;
revoke all on function public.day_block_reason(date, boolean, public.fulfillment_mode) from public, anon, authenticated;

drop function public.get_availability(date, date, integer, boolean);
create function public.get_availability(
  p_from date, p_to date, p_lead_hours integer default 0, p_made_to_order boolean default true,
  p_fulfillment public.fulfillment_mode default null
) returns table (day date, available boolean, reason text)
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.store_settings;
  v_today date;
  v_min date;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 120 then
    raise exception 'Rango de fechas inválido (máximo 120 días)' using errcode = '22023';
  end if;
  select * into s from public.store_settings where id;
  v_today := (now() at time zone s.timezone)::date;
  v_min := ((now() + make_interval(hours => greatest(coalesce(p_lead_hours, 0), s.min_lead_hours))) at time zone s.timezone)::date;
  return query
    select d::date, r is null, r
      from generate_series(p_from, p_to, interval '1 day') d
      cross join lateral (
        select case
                 when d::date < v_today then 'past'
                 when d::date < v_min then 'lead'
                 else public.day_block_reason(d::date, coalesce(p_made_to_order, true), p_fulfillment)
               end as r
      ) x(r)
     order by 1;
end;
$$;
revoke all on function public.get_availability(date, date, integer, boolean, public.fulfillment_mode) from public, anon, authenticated;
grant execute on function public.get_availability(date, date, integer, boolean, public.fulfillment_mode) to anon, authenticated;

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
               'closed', coalesce(public.day_block_reason(d::date, false) = 'closed', false),
               'pickup_closed', coalesce(public.day_block_reason(d::date, false, 'pickup') = 'pickup_closed', false)
             ) order by d), '[]'::jsonb)
        from generate_series(v_today, v_today + greatest(1, least(coalesce(p_days, 14), 60)) - 1, interval '1 day') d
    )
  );
end;
$$;

-- H3: cupo de una fecha para el panel (confirmar un pendiente caducado puede rebasarlo).
create function public.admin_day_capacity(p_day date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'capacity', (select daily_capacity from public.store_settings where id),
    'orders', public.capacity_used(p_day)
  );
end;
$$;
revoke all on function public.admin_day_capacity(date) from public, anon, authenticated;
grant execute on function public.admin_day_capacity(date) to authenticated;

create or replace function public.create_order(
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_fulfillment public.fulfillment_mode,
  p_requested_date date,
  p_notes text,
  p_privacy_accepted boolean,
  p_items jsonb
) returns table (folio text, public_token text, total_cents integer, status public.order_status)
language plpgsql volatile security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_settings public.store_settings;
  v_order_id uuid;
  v_lines jsonb;
  v_total integer := 0;
  v_max_lead integer := 0;
  v_has_mto boolean := false;
  v_min_date date;
  v_count integer;
  v_reason text;
  v_phone_digits text := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
begin
  if p_idempotency_key is null then
    raise exception 'Falta la clave de idempotencia' using errcode = '22023';
  end if;

  -- Reintento con la misma clave: devolver el pedido existente sin crear otro.
  return query
    select o.folio, o.public_token, o.total_cents, o.status
      from public.orders o where o.idempotency_key = p_idempotency_key;
  if found then
    return;
  end if;

  if p_privacy_accepted is not true then
    raise exception 'Debe aceptar el aviso de privacidad' using errcode = '22023';
  end if;
  if length(v_phone_digits) < 8 then
    raise exception 'Ingrese un teléfono con al menos 8 dígitos' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'El carrito debe tener entre 1 y 30 productos' using errcode = '22023';
  end if;

  select count(*) into v_count from public.orders o
   where regexp_replace(o.customer_phone, '\D', '', 'g') = v_phone_digits
     and o.status = 'pending_contact'
     and o.created_at > now() - interval '1 hour';
  if v_count >= 5 then
    raise exception 'Demasiados pedidos recientes; intente más tarde' using errcode = '54000';
  end if;

  select * into v_settings from public.store_settings where id;

  select jsonb_agg(jsonb_build_object('product_id', g.product_id, 'quantity', g.quantity,
                                      'customization', g.customization))
    into v_lines
    from (
      select (x->>'product_id')::uuid as product_id,
             sum((x->>'quantity')::int)::int as quantity,
             left(max(nullif(trim(x->>'customization'), '')), 500) as customization
        from jsonb_array_elements(p_items) x
       group by 1
    ) g;

  if exists (
    select 1 from jsonb_to_recordset(v_lines) l(product_id uuid, quantity int)
     where l.product_id is null or l.quantity is null or l.quantity not between 1 and 99
  ) then
    raise exception 'Cantidad o producto inválido' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_lines) l(product_id uuid)
     left join public.products p on p.id = l.product_id and p.active
     left join public.categories c on c.id = p.category_id and c.active
     where p.id is null or c.id is null
  ) then
    raise exception 'Producto no disponible' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_lines) l(product_id uuid, quantity int)
      join public.products p on p.id = l.product_id
     where p.fulfillment_type = 'stock' and p.stock_quantity < l.quantity
  ) then
    raise exception 'Existencias insuficientes' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(v_lines) l(product_id uuid, customization text)
      join public.products p on p.id = l.product_id
     where l.customization is not null and not p.allows_customization
  ) then
    raise exception 'Un producto del carrito no admite personalización' using errcode = '22023';
  end if;

  select coalesce(sum(p.price_cents::bigint * l.quantity), 0), coalesce(max(p.lead_time_hours), 0),
         coalesce(bool_or(p.fulfillment_type = 'made_to_order'), false)
    into v_total, v_max_lead, v_has_mto
    from jsonb_to_recordset(v_lines) l(product_id uuid, quantity int)
    join public.products p on p.id = l.product_id;

  v_max_lead := greatest(v_max_lead, v_settings.min_lead_hours);
  v_min_date := ((now() + make_interval(hours => v_max_lead)) at time zone v_settings.timezone)::date;
  if p_requested_date is null or p_requested_date < v_min_date then
    raise exception 'La fecha solicitada debe ser a partir del %', to_char(v_min_date, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;
  if p_requested_date > v_min_date + 90 then
    raise exception 'La fecha solicitada es demasiado lejana' using errcode = '22023';
  end if;

  if v_has_mto and v_settings.daily_capacity is not null then
    perform pg_advisory_xact_lock(hashtextextended('luchy-capacidad:' || p_requested_date::text, 0));
    -- H1: mientras esperábamos el bloqueo pudo confirmarse un envío gemelo con la misma clave.
    return query
      select o.folio, o.public_token, o.total_cents, o.status
        from public.orders o where o.idempotency_key = p_idempotency_key;
    if found then
      return;
    end if;
  end if;

  v_reason := public.day_block_reason(p_requested_date, v_has_mto, p_fulfillment);
  if v_reason = 'closed' then
    raise exception 'La tienda no recibe pedidos para esa fecha; elige otra' using errcode = '22023';
  elsif v_reason = 'pickup_closed' then
    raise exception 'Ese día no hay recolección en tienda; elige entrega a domicilio u otra fecha' using errcode = '22023';
  elsif v_reason = 'full' then
    raise exception 'Ya no hay cupo para esa fecha; elige otra' using errcode = '22023';
  end if;

  for i in 1..5 loop
    begin
      insert into public.orders (
        folio, idempotency_key, customer_name, customer_phone, customer_email, fulfillment,
        requested_date, notes, privacy_accepted_at, total_cents, expires_at
      ) values (
        public.gen_folio(), p_idempotency_key, trim(p_customer_name), trim(p_customer_phone),
        nullif(trim(p_customer_email), ''), p_fulfillment, p_requested_date, nullif(trim(p_notes), ''),
        now(), v_total, now() + make_interval(hours => v_settings.order_expiry_hours)
      ) returning id into v_order_id;
      exit;
    exception when unique_violation then
      if exists (select 1 from public.orders o where o.idempotency_key = p_idempotency_key) then
        return query
          select o.folio, o.public_token, o.total_cents, o.status
            from public.orders o where o.idempotency_key = p_idempotency_key;
        return;
      end if;
      if i = 5 then raise; end if;
    end;
  end loop;

  insert into public.order_items (order_id, product_id, sku, name, unit_price_cents, quantity, customization)
    select v_order_id, p.id, p.sku, p.name, p.price_cents, l.quantity, l.customization
      from jsonb_to_recordset(v_lines) l(product_id uuid, quantity int, customization text)
      join public.products p on p.id = l.product_id;

  return query
    select o.folio, o.public_token, o.total_cents, o.status from public.orders o where o.id = v_order_id;
end;
$$;
