-- Fase 8: repostería especializada. Personalización por producto, días cerrados, anticipación
-- general y capacidad diaria. Valores por defecto neutros: sin límite y sin días cerrados
-- (la política real está pendiente, CLAUDE.md §14).

alter table public.products
  add column allows_customization boolean not null default false,
  add column customization_hint text check (customization_hint is null or char_length(customization_hint) <= 120);

alter table public.store_settings
  -- 0 = domingo … 6 = sábado (extract(dow)).
  add column closed_weekdays smallint[] not null default '{}'
    check (closed_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(closed_weekdays) < 7),
  add column closed_dates date[] not null default '{}' check (cardinality(closed_dates) <= 400),
  -- Máximo de pedidos con productos «bajo pedido» por fecha solicitada; nulo = sin límite.
  add column daily_capacity integer check (daily_capacity is null or daily_capacity between 1 and 1000),
  -- Anticipación mínima para cualquier pedido, además de la de cada producto.
  add column min_lead_hours integer not null default 0 check (min_lead_hours between 0 and 720);

grant insert (allows_customization, customization_hint) on public.products to authenticated;
grant update (allows_customization, customization_hint) on public.products to authenticated;
grant update (closed_weekdays, closed_dates, daily_capacity, min_lead_hours) on public.store_settings to authenticated;

create index orders_requested_date_idx on public.orders (requested_date) where status <> 'cancelled';

-- Vista pública: se añaden las columnas al final para conservar el orden existente.
create or replace view public.catalog_products as
  select p.id, p.slug, p.sku, p.name, p.description, p.price_cents,
         p.allergens, p.allergens_verified, p.lead_time_hours, p.fulfillment_type, p.featured,
         (p.fulfillment_type = 'made_to_order' or p.stock_quantity > 0) as available,
         c.id as category_id, c.slug as category_slug, c.name as category_name,
         p.allows_customization, p.customization_hint
    from public.products p
    join public.categories c on c.id = p.category_id
   where p.active and c.active;

-- Cupo ocupado en una fecha: pedidos con productos bajo pedido que no se cancelaron. Un pedido
-- pendiente reserva su lugar hasta que caduca, para no sobrevender mientras la tienda lo confirma.
create function public.capacity_used(p_day date) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int
    from public.orders o
   where o.requested_date = p_day
     and o.status <> 'cancelled'
     and (o.status <> 'pending_contact' or o.expires_at > now())
     and exists (
       select 1 from public.order_items i
         join public.products p on p.id = i.product_id
        where i.order_id = o.id and p.fulfillment_type = 'made_to_order'
     );
$$;

-- Motivo por el que una fecha no admite pedidos: 'closed', 'full' o nulo si está disponible.
create function public.day_block_reason(p_day date, p_made_to_order boolean) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.store_settings;
begin
  select * into s from public.store_settings where id;
  if extract(dow from p_day)::smallint = any (s.closed_weekdays) or p_day = any (s.closed_dates) then
    return 'closed';
  end if;
  if p_made_to_order and s.daily_capacity is not null and public.capacity_used(p_day) >= s.daily_capacity then
    return 'full';
  end if;
  return null;
end;
$$;

-- Disponibilidad pública por día. No revela cuántos pedidos hay, solo si se puede pedir.
-- reason: 'past' (ya pasó), 'lead' (falta anticipación), 'closed', 'full'.
create function public.get_availability(
  p_from date, p_to date, p_lead_hours integer default 0, p_made_to_order boolean default true
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
    select d::date,
           r is null,
           r
      from generate_series(p_from, p_to, interval '1 day') d
      cross join lateral (
        select case
                 when d::date < v_today then 'past'
                 when d::date < v_min then 'lead'
                 else public.day_block_reason(d::date, coalesce(p_made_to_order, true))
               end as r
      ) x(r)
     order by 1;
end;
$$;

-- Carga de los próximos días para el panel (solo administradores).
create function public.admin_capacity(p_days integer default 14) returns jsonb
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
               'closed', public.day_block_reason(d::date, false) = 'closed'
             ) order by d), '[]'::jsonb)
        from generate_series(v_today, v_today + greatest(1, least(coalesce(p_days, 14), 60)) - 1, interval '1 day') d
    )
  );
end;
$$;

-- create_order: añade personalización por producto, anticipación general, días cerrados y capacidad.
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
  -- La personalización solo existe en productos que la admiten (la define la tienda, no el cliente).
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

  -- Un solo pedido a la vez por fecha cuando hay cupo limitado: evita sobrevender por concurrencia.
  if v_has_mto and v_settings.daily_capacity is not null then
    perform pg_advisory_xact_lock(hashtextextended('luchy-capacidad:' || p_requested_date::text, 0));
  end if;
  v_reason := public.day_block_reason(p_requested_date, v_has_mto);
  if v_reason = 'closed' then
    raise exception 'La tienda no recibe pedidos para esa fecha; elige otra' using errcode = '22023';
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

revoke all on function public.capacity_used(date), public.day_block_reason(date, boolean) from public, anon, authenticated;
revoke all on function public.get_availability(date, date, integer, boolean), public.admin_capacity(integer)
  from public, anon, authenticated;
grant execute on function public.get_availability(date, date, integer, boolean) to anon, authenticated;
grant execute on function public.admin_capacity(integer) to authenticated;
grant execute on function public.create_order(uuid, text, text, text, public.fulfillment_mode, date, text, boolean, jsonb)
  to anon, authenticated;
