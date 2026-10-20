-- Revisión Opus de la Fase 7.
-- H3: la zona horaria se valida en la base de datos, no solo en el formulario. Un valor inválido
--     haría fallar todos los create_order (y el cliente vería el error técnico de Postgres).

create function public.validate_store_settings() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Zona horaria no válida: %', new.timezone using errcode = '22023';
  end if;
  if new.order_expiry_hours > 720 then
    raise exception 'La caducidad no puede superar 720 horas' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_store_settings() from public, anon, authenticated;

create trigger store_settings_validate
  before insert or update on public.store_settings
  for each row execute function public.validate_store_settings();
