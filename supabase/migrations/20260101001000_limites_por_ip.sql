-- Fase 9: límite de solicitudes por IP para las funciones públicas (D7; H4 de la revisión de la Fase 8).
--
-- Origen de la IP (verificado contra el proyecto real, 2026-10-20):
--   * cf-connecting-ip lo pone Cloudflare; una petición que intenta falsificarlo recibe 403.
--   * x-forwarded-for acepta valores antepuestos por el cliente; solo su ÚLTIMA entrada es fiable.
-- Sin cabeceras (conexión directa: pg_cron, SQL Editor, pruebas) no se aplica límite.
-- La IP se guarda como hash con una sal secreta: es un dato personal y no hace falta conservarla.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.secrets (name text primary key, value text not null);
insert into private.secrets (name, value)
values ('rate_limit_salt', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

create table private.rate_limit_hits (
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, key_hash, window_start)
);
revoke all on all tables in schema private from public, anon, authenticated;

-- Hash de la IP del cliente para esta petición, o nulo si no viene de la API.
create function private.client_key() returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  h json := nullif(current_setting('request.headers', true), '')::json;
  ip text;
begin
  if h is null then
    return null;
  end if;
  ip := nullif(trim(h->>'cf-connecting-ip'), '');
  if ip is null then
    -- Última entrada de x-forwarded-for: la añadió el proxy; las anteriores las puede poner el cliente.
    ip := nullif(trim((regexp_split_to_array(coalesce(h->>'x-forwarded-for', ''), '\s*,\s*'))[
            array_length(regexp_split_to_array(coalesce(h->>'x-forwarded-for', ''), '\s*,\s*'), 1)]), '');
  end if;
  if ip is null then
    return null;
  end if;
  return encode(extensions.digest(ip || (select value from private.secrets where name = 'rate_limit_salt'), 'sha256'), 'hex');
end;
$$;

-- Ventana fija: cuenta la solicitud y lanza 54000 si se supera el límite.
create function private.enforce_rate_limit(p_bucket text, p_limit integer, p_window interval) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_key text := private.client_key();
  v_window timestamptz;
  v_hits integer;
begin
  if v_key is null then
    return;
  end if;
  v_window := date_bin(p_window, now(), timestamptz '2000-01-01');
  insert into private.rate_limit_hits as r (bucket, key_hash, window_start, hits)
  values (p_bucket, v_key, v_window, 1)
  on conflict (bucket, key_hash, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  if v_hits > p_limit then
    raise exception 'Demasiadas solicitudes; espera unos minutos e inténtalo de nuevo' using errcode = '54000';
  end if;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;

-- Las funciones existentes pasan a ser la implementación interna; los envoltorios públicos aplican el
-- límite y conservan exactamente la misma firma para el cliente.
alter function public.create_order(uuid, text, text, text, public.fulfillment_mode, date, text, boolean, jsonb)
  rename to create_order_impl;
alter function public.get_availability(date, date, integer, boolean, public.fulfillment_mode)
  rename to get_availability_impl;
alter function public.get_order_public(text, text) rename to get_order_public_impl;
revoke all on function
  public.create_order_impl(uuid, text, text, text, public.fulfillment_mode, date, text, boolean, jsonb),
  public.get_availability_impl(date, date, integer, boolean, public.fulfillment_mode),
  public.get_order_public_impl(text, text)
  from public, anon, authenticated;

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
begin
  -- Un reintento del mismo pedido nunca se bloquea: se devuelve antes de contar la solicitud.
  return query
    select o.folio, o.public_token, o.total_cents, o.status
      from public.orders o where o.idempotency_key = p_idempotency_key;
  if found then
    return;
  end if;
  perform private.enforce_rate_limit('create_order', 10, interval '1 hour');
  return query
    select * from public.create_order_impl(p_idempotency_key, p_customer_name, p_customer_phone, p_customer_email,
                                           p_fulfillment, p_requested_date, p_notes, p_privacy_accepted, p_items);
end;
$$;

create function public.get_availability(
  p_from date, p_to date, p_lead_hours integer default 0, p_made_to_order boolean default true,
  p_fulfillment public.fulfillment_mode default null
) returns table (day date, available boolean, reason text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.enforce_rate_limit('get_availability', 60, interval '10 minutes');
  return query select * from public.get_availability_impl(p_from, p_to, p_lead_hours, p_made_to_order, p_fulfillment);
end;
$$;

create function public.get_order_public(p_folio text, p_token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.enforce_rate_limit('get_order_public', 60, interval '10 minutes');
  return public.get_order_public_impl(p_folio, p_token);
end;
$$;

revoke all on function
  public.create_order(uuid, text, text, text, public.fulfillment_mode, date, text, boolean, jsonb),
  public.get_availability(date, date, integer, boolean, public.fulfillment_mode),
  public.get_order_public(text, text)
  from public;
grant execute on function
  public.create_order(uuid, text, text, text, public.fulfillment_mode, date, text, boolean, jsonb),
  public.get_availability(date, date, integer, boolean, public.fulfillment_mode),
  public.get_order_public(text, text)
  to anon, authenticated;

-- Limpieza de contadores viejos cada hora.
select cron.schedule(
  'luchy-purge-rate-limits',
  '35 * * * *',
  $$delete from private.rate_limit_hits where window_start < now() - interval '1 day'$$
);
