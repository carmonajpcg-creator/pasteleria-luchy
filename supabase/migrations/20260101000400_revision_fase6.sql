-- Revisión Opus de la Fase 6.
-- H1: el cliente necesita la zona horaria de la tienda para calcular la fecha mínima igual que
--     create_order (no es un dato sensible).
-- H2: el antispam compara teléfonos normalizados a dígitos y exige al menos 8 dígitos.
-- H3: caducidad automática de pedidos pendientes con pg_cron.

grant select (timezone) on public.store_settings to anon;

create index orders_phone_digits_idx
  on public.orders (regexp_replace(customer_phone, '\D', '', 'g'), created_at desc);

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
  v_min_date date;
  v_count integer;
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

  -- Antispam básico: tope de pedidos pendientes por teléfono (normalizado) en la última hora.
  -- El límite por IP se implementará en Edge Function (D7).
  select count(*) into v_count from public.orders o
   where regexp_replace(o.customer_phone, '\D', '', 'g') = v_phone_digits
     and o.status = 'pending_contact'
     and o.created_at > now() - interval '1 hour';
  if v_count >= 5 then
    raise exception 'Demasiados pedidos recientes; intente más tarde' using errcode = '54000';
  end if;

  select * into v_settings from public.store_settings where id;

  -- Normaliza líneas (suma cantidades repetidas) y une con productos activos.
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

  select coalesce(sum(p.price_cents::bigint * l.quantity), 0), coalesce(max(p.lead_time_hours), 0)
    into v_total, v_max_lead
    from jsonb_to_recordset(v_lines) l(product_id uuid, quantity int)
    join public.products p on p.id = l.product_id;

  v_min_date := ((now() + make_interval(hours => v_max_lead)) at time zone v_settings.timezone)::date;
  if p_requested_date is null or p_requested_date < v_min_date then
    raise exception 'La fecha solicitada debe ser a partir del %', to_char(v_min_date, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;
  if p_requested_date > v_min_date + 90 then
    raise exception 'La fecha solicitada es demasiado lejana' using errcode = '22023';
  end if;

  -- Folio aleatorio con reintento ante colisión.
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
      -- Otra petición concurrente con la misma clave ganó: devolver ese pedido.
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

-- H3: cada hora se cancelan los pedidos pendientes vencidos (sin stock que reponer).
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'luchy-expire-pending-orders',
  '15 * * * *',
  $$select public.expire_pending_orders()$$
);
