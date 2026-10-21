-- Fase 10 (auditoría Opus, A7): aviso visible de «sitio en preparación».
-- Con productos y precios de ejemplo publicados junto al WhatsApp real, el aviso se muestra en todo el
-- sitio y se antepone al mensaje de WhatsApp para que la tienda distinga esos pedidos. Nulo = sin aviso.

alter table public.store_settings
  add column demo_notice text check (demo_notice is null or char_length(demo_notice) between 1 and 200);

grant select (demo_notice) on public.store_settings to anon;
grant update (demo_notice) on public.store_settings to authenticated;
