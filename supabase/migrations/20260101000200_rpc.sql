-- Fase 4: operaciones privilegiadas. Todas SECURITY DEFINER con search_path vacío.

create function public.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
end;
$$;

-- Folio legible no secuencial (sin caracteres ambiguos). No es secreto: el acceso usa public_token.
create function public.gen_folio() returns text
language sql volatile set search_path = '' as $$
  select 'L-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
    from generate_series(1, 7);
$$;

-- create_order --------------------------------------------------------------------
-- p_items: [{"product_id": uuid, "quantity": int, "customization": text?}, ...]
-- El cliente nunca envía precios ni totales. Idempotente por p_idempotency_key.
create function public.create_order(
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
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'El carrito debe tener entre 1 y 30 productos' using errcode = '22023';
  end if;

  -- Antispam básico: tope de pedidos pendientes por teléfono en la última hora.
  -- El límite por IP se implementará en Edge Function (D7).
  select count(*) into v_count from public.orders o
   where o.customer_phone = trim(p_customer_phone)
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
    raise exception 'La fecha solicitada debe ser a partir del %', v_min_date using errcode = '22023';
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

-- get_order_public: datos no sensibles de un pedido, solo con folio + token.
create function public.get_order_public(p_folio text, p_token text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'folio', o.folio,
    'status', o.status,
    'payment_status', o.payment_status,
    'fulfillment', o.fulfillment,
    'requested_date', o.requested_date,
    'total_cents', o.total_cents,
    'created_at', o.created_at,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', i.name, 'quantity', i.quantity,
               'unit_price_cents', i.unit_price_cents, 'line_total_cents', i.line_total_cents
             ) order by i.name), '[]'::jsonb)
        from public.order_items i where i.order_id = o.id
    )
  )
  from public.orders o
  where o.folio = p_folio and o.public_token = p_token;
$$;

-- confirm_order: descuenta stock una sola vez, de forma atómica. Idempotente.
create function public.confirm_order(p_order_id uuid) returns public.order_status
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_item record;
begin
  perform public.require_admin();

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_order.status <> 'pending_contact' then
    if v_order.status = 'cancelled' then
      raise exception 'El pedido está cancelado' using errcode = '22023';
    end if;
    return v_order.status; -- ya confirmado o posterior: sin efectos
  end if;

  -- Bloquea productos en orden fijo para evitar interbloqueos entre confirmaciones.
  for v_item in
    select i.product_id, i.quantity, p.stock_quantity, p.name
      from public.order_items i
      join public.products p on p.id = i.product_id
     where i.order_id = p_order_id and p.fulfillment_type = 'stock'
     order by i.product_id
     for update of p
  loop
    if v_item.stock_quantity < v_item.quantity then
      raise exception 'Existencias insuficientes de %', v_item.name using errcode = '22023';
    end if;
    update public.products set stock_quantity = stock_quantity - v_item.quantity
     where id = v_item.product_id;
    insert into public.inventory_movements (product_id, delta, reason, order_id, actor)
      values (v_item.product_id, -v_item.quantity, 'order_confirmed', p_order_id, auth.uid());
  end loop;

  update public.orders
     set status = 'confirmed', stock_deducted = true, confirmed_at = now()
   where id = p_order_id;
  return 'confirmed';
end;
$$;

-- advance_order: confirmed → in_preparation → ready → delivered.
create function public.advance_order(p_order_id uuid, p_to public.order_status)
returns public.order_status
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_from public.order_status;
begin
  perform public.require_admin();
  select status into v_from from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_from = p_to then
    return v_from;
  end if;
  if not coalesce(case v_from
       when 'confirmed' then p_to = 'in_preparation'
       when 'in_preparation' then p_to = 'ready'
       when 'ready' then p_to = 'delivered'
       else false
     end, false) then
    raise exception 'Transición no permitida: % → %', v_from, p_to using errcode = '22023';
  end if;
  update public.orders set status = p_to where id = p_order_id;
  return p_to;
end;
$$;

-- cancel_order: repone stock si se había descontado. Idempotente.
create function public.cancel_order(p_order_id uuid, p_reason text) returns public.order_status
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_item record;
begin
  perform public.require_admin();
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'Indique el motivo de la cancelación' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_order.status = 'cancelled' then
    return 'cancelled';
  end if;
  if v_order.status in ('ready', 'delivered') then
    raise exception 'No se puede cancelar un pedido %', v_order.status using errcode = '22023';
  end if;

  if v_order.stock_deducted then
    for v_item in
      select i.product_id, i.quantity
        from public.order_items i
        join public.products p on p.id = i.product_id
       where i.order_id = p_order_id and p.fulfillment_type = 'stock'
       order by i.product_id
         for update of p
    loop
      update public.products set stock_quantity = stock_quantity + v_item.quantity
       where id = v_item.product_id;
      insert into public.inventory_movements (product_id, delta, reason, order_id, actor, note)
        values (v_item.product_id, v_item.quantity, 'order_cancelled', p_order_id, auth.uid(), trim(p_reason));
    end loop;
  end if;

  update public.orders
     set status = 'cancelled', stock_deducted = false, cancelled_at = now(), cancel_reason = trim(p_reason)
   where id = p_order_id;
  return 'cancelled';
end;
$$;

-- adjust_stock: movimientos manuales auditados de productos terminados.
create function public.adjust_stock(
  p_product_id uuid, p_delta integer, p_reason public.movement_reason, p_note text
) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_new integer;
begin
  perform public.require_admin();
  if p_reason in ('order_confirmed', 'order_cancelled') then
    raise exception 'Motivo reservado para pedidos' using errcode = '22023';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'La cantidad no puede ser cero' using errcode = '22023';
  end if;

  update public.products set stock_quantity = stock_quantity + p_delta
   where id = p_product_id and fulfillment_type = 'stock'
   returning stock_quantity into v_new;
  if not found then
    raise exception 'Producto no encontrado o sin inventario físico' using errcode = '22023';
  end if;
  -- El CHECK (stock_quantity >= 0) impide quedar en negativo.
  insert into public.inventory_movements (product_id, delta, reason, actor, note)
    values (p_product_id, p_delta, p_reason, auth.uid(), nullif(trim(p_note), ''));
  return v_new;
end;
$$;

-- expire_pending_orders: cancela pendientes vencidos (sin stock que reponer).
-- Pensada para pg_cron o ejecución manual del admin.
create function public.expire_pending_orders() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if auth.uid() is not null then
    perform public.require_admin();
  end if;
  update public.orders
     set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Caducado sin confirmar'
   where status = 'pending_contact' and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- EXECUTE a PUBLIC es un privilegio por defecto global que ALTER DEFAULT PRIVILEGES ... IN SCHEMA
-- no retira; se revoca explícitamente y se concede solo lo necesario.
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin(), public.is_product_public(uuid) to anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, public.fulfillment_mode, date, text, boolean, jsonb)
  to anon, authenticated;
grant execute on function public.get_order_public(text, text) to anon, authenticated;
grant execute on function
  public.confirm_order(uuid),
  public.advance_order(uuid, public.order_status),
  public.cancel_order(uuid, text),
  public.adjust_stock(uuid, integer, public.movement_reason, text),
  public.expire_pending_orders()
  to authenticated;
