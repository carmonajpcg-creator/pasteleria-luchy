-- Aviso por correo de cada pedido nuevo.
-- Un disparador avisa a la Edge Function `notify-order` (vía pg_net, asíncrono y después del commit) con solo el id
-- del pedido; la función lee el pedido con privilegios de servicio y manda el correo por SMTP.
--
-- Garantías:
--   * Nunca bloquea ni rompe un pedido: cualquier fallo se ignora (el pedido ya está registrado).
--   * No hay URL ni secreto en el repositorio: se guardan en Vault (`order_webhook_url`, `order_webhook_secret`)
--     al configurar cada proyecto. Sin ellos el disparador no hace nada (pruebas locales, proyectos nuevos).
--   * El cliente anónimo no puede leer ni cambiar nada de esto (funciones sin ejecución pública).

create extension if not exists pg_net with schema extensions;

create function public.notify_new_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'order_webhook_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'order_webhook_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('order_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new; -- el aviso es accesorio: jamás debe impedir el pedido
end;
$$;

revoke all on function public.notify_new_order() from public, anon, authenticated;

create trigger orders_notify_new
  after insert on public.orders
  for each row execute function public.notify_new_order();
