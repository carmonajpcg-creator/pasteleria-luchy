-- Fase 4: privilegios mínimos y Row Level Security.
-- Supabase concede por defecto todo a anon/authenticated; se revoca y se concede explícitamente.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.payments enable row level security;

-- profiles: cada quien ve su fila; nadie escribe desde el cliente (sin grants de escritura).
grant select on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- categories: lectura pública de activas; CRUD solo admin.
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
create policy categories_public_read on public.categories for select to anon, authenticated
  using (active or (select public.is_admin()));
create policy categories_admin_insert on public.categories for insert to authenticated
  with check ((select public.is_admin()));
create policy categories_admin_update on public.categories for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy categories_admin_delete on public.categories for delete to authenticated
  using ((select public.is_admin()));

-- products: el público lee por la vista catalog_products (sin cifras de stock).
-- stock_quantity queda fuera de los grants de escritura: solo cambia vía RPC de inventario.
grant select on public.products to authenticated;
grant insert (category_id, sku, slug, name, description, price_cents, allergens, allergens_verified,
              lead_time_hours, fulfillment_type, low_stock_threshold, featured, active)
  on public.products to authenticated;
grant update (category_id, sku, slug, name, description, price_cents, allergens, allergens_verified,
              lead_time_hours, fulfillment_type, low_stock_threshold, featured, active)
  on public.products to authenticated;
create policy products_admin_select on public.products for select to authenticated
  using ((select public.is_admin()));
create policy products_admin_insert on public.products for insert to authenticated
  with check ((select public.is_admin()));
create policy products_admin_update on public.products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- Sin DELETE: los productos con historial se desactivan (active = false).

-- product_images: lectura pública de imágenes de productos activos; escritura admin.
-- anon no tiene SELECT sobre products, por eso la comprobación va en una función definer.
create function public.is_product_public(p_product_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.products p join public.categories c on c.id = p.category_id
     where p.id = p_product_id and p.active and c.active
  );
$$;
grant execute on function public.is_product_public(uuid) to anon, authenticated;

grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;
create policy product_images_public_read on public.product_images for select to anon, authenticated
  using (public.is_product_public(product_id) or (select public.is_admin()));
create policy product_images_admin_insert on public.product_images for insert to authenticated
  with check ((select public.is_admin()));
create policy product_images_admin_update on public.product_images for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy product_images_admin_delete on public.product_images for delete to authenticated
  using ((select public.is_admin()));

-- store_settings: anon solo ve columnas públicas; admin lee y edita todo.
grant select (store_name, whatsapp_number, contact_email, contact_phone, schedule_text, coverage_text)
  on public.store_settings to anon;
grant select on public.store_settings to authenticated;
grant update (store_name, whatsapp_number, contact_email, contact_phone, schedule_text, coverage_text,
              timezone, order_expiry_hours)
  on public.store_settings to authenticated;
create policy store_settings_public_read on public.store_settings for select to anon
  using (true);
create policy store_settings_admin_read on public.store_settings for select to authenticated
  using ((select public.is_admin()));
create policy store_settings_admin_update on public.store_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- orders / order_items: anon nunca lee directo (usa get_order_public con token).
-- Escrituras solo por RPC SECURITY DEFINER.
grant select on public.orders, public.order_items to authenticated;
create policy orders_admin_select on public.orders for select to authenticated
  using ((select public.is_admin()));
create policy order_items_admin_select on public.order_items for select to authenticated
  using ((select public.is_admin()));

-- inventory_movements: lectura admin; inserción solo por RPC.
grant select on public.inventory_movements to authenticated;
create policy inventory_movements_admin_select on public.inventory_movements for select to authenticated
  using ((select public.is_admin()));

-- payments: admin lee e inserta (append-only por trigger); recorded_by debe ser quien registra.
grant select on public.payments to authenticated;
grant insert (order_id, amount_cents, is_refund, method, note, paid_at) on public.payments to authenticated;
create policy payments_admin_select on public.payments for select to authenticated
  using ((select public.is_admin()));
create policy payments_admin_insert on public.payments for insert to authenticated
  with check ((select public.is_admin()) and recorded_by = (select auth.uid()));

-- Vista pública del catálogo: solo productos y categorías activos, disponibilidad booleana.
create view public.catalog_products as
  select p.id, p.slug, p.sku, p.name, p.description, p.price_cents,
         p.allergens, p.allergens_verified, p.lead_time_hours, p.fulfillment_type, p.featured,
         (p.fulfillment_type = 'made_to_order' or p.stock_quantity > 0) as available,
         c.id as category_id, c.slug as category_slug, c.name as category_name
    from public.products p
    join public.categories c on c.id = p.category_id
   where p.active and c.active;
-- La vista corre con privilegios del propietario a propósito (expone solo columnas seguras).
grant select on public.catalog_products to anon, authenticated;
