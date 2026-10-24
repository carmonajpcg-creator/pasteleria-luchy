-- Fase 9: regresión de seguridad. Fija la superficie expuesta a anon y authenticated: si una migración
-- futura concede un permiso de más (o quita RLS / search_path), esta prueba falla.
-- Los nombres del catálogo usan la colación "C"; se agregan como texto con colación "default" y se
-- comparan con is(), que muestra lo obtenido frente a lo esperado si difieren.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- RLS y funciones privilegiadas -----------------------------------------------------------------
select is(
  (select coalesce(string_agg(relname::text collate "default", ','), '') from pg_class
    where relnamespace = 'public'::regnamespace and relkind in ('r', 'p') and not relrowsecurity),
  '', 'todas las tablas de public tienen RLS activada');
select is(
  (select coalesce(string_agg(proname::text collate "default", ','), '') from pg_proc
    where pronamespace = 'public'::regnamespace and prosecdef
      and not coalesce(array_to_string(proconfig, ',') like '%search_path=%', false)),
  '', 'toda función SECURITY DEFINER fija su search_path');
select is(
  (select coalesce(string_agg(relname::text collate "default", ','), '') from pg_class
    where relnamespace = 'public'::regnamespace and relkind in ('r', 'p') and relforcerowsecurity),
  '', 'ninguna tabla usa FORCE RLS por accidente (el propietario de las RPC debe poder operar)');

-- Funciones ejecutables -------------------------------------------------------------------------
select is(
  (select string_agg(proname::text collate "default", ',' order by proname::text collate "default") from pg_proc
    where pronamespace = 'public'::regnamespace and has_function_privilege('anon', oid, 'execute')),
  'create_order,get_availability,get_order_public,is_admin,is_product_public',
  'anon solo ejecuta las funciones públicas previstas');
select is(
  (select string_agg(proname::text collate "default", ',' order by proname::text collate "default") from pg_proc
    where pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', oid, 'execute')),
  'adjust_stock,admin_capacity,admin_dashboard,admin_day_capacity,admin_sales_report,advance_order,cancel_order,confirm_order,'
    || 'create_order,expire_pending_orders,get_availability,get_order_public,is_admin,is_product_public',
  'authenticated solo ejecuta las funciones previstas (las de admin validan el rol dentro)');
select is(
  (select coalesce(string_agg(proname::text collate "default", ','), '') from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname::text in ('capacity_used', 'day_block_reason', 'require_admin', 'gen_folio', 'recalc_payment_status',
                            'block_mutation', 'set_updated_at', 'validate_store_settings',
                            'create_order_impl', 'get_availability_impl', 'get_order_public_impl')
      and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute'))),
  '', 'las funciones internas no son ejecutables desde la API');

-- Privilegios de tabla --------------------------------------------------------------------------
select is(
  (select string_agg(g, ';' order by g) from (
     select (table_name::text || ':' || string_agg(privilege_type::text, ',' order by privilege_type::text)) collate "default" as g
       from information_schema.role_table_grants
      where grantee = 'anon' and table_schema = 'public' group by table_name::text) x),
  'catalog_products:SELECT;categories:SELECT;product_images:SELECT',
  'anon solo lee el catálogo, las categorías y las imágenes');
select is(
  (select string_agg(column_name::text collate "default", ',' order by column_name::text collate "default")
     from information_schema.role_column_grants
    where grantee = 'anon' and table_schema = 'public' and table_name::text = 'store_settings'),
  'contact_email,contact_phone,coverage_text,demo_notice,schedule_text,store_name,timezone,whatsapp_number',
  'anon solo lee las columnas públicas de la configuración');
select ok(
  not exists (select 1 from information_schema.role_column_grants
               where grantee = 'anon' and table_schema = 'public' and privilege_type::text <> 'SELECT'),
  'anon no tiene ningún permiso de escritura, ni por columna');
select is(
  (select string_agg(g, ';' order by g) from (
     select (table_name::text || ':' || string_agg(privilege_type::text, ',' order by privilege_type::text)) collate "default" as g
       from information_schema.role_table_grants
      where grantee = 'authenticated' and table_schema = 'public' group by table_name::text) x),
  'catalog_products:SELECT;categories:DELETE,INSERT,SELECT,UPDATE;inventory_movements:SELECT;order_items:SELECT;'
    || 'orders:SELECT;payments:SELECT;product_images:DELETE,INSERT,SELECT,UPDATE;products:SELECT;profiles:SELECT;'
    || 'store_settings:SELECT',
  'privilegios de tabla de authenticated: sin escritura directa en pedidos, pagos, movimientos ni perfiles');
select ok(
  not exists (select 1 from information_schema.role_column_grants
               where grantee = 'authenticated' and table_schema = 'public' and table_name::text = 'products'
                 and column_name::text = 'stock_quantity' and privilege_type::text <> 'SELECT'),
  'el stock no se puede escribir por columna');
select is(
  (select string_agg(column_name::text collate "default", ',' order by column_name::text collate "default")
     from information_schema.role_column_grants
    where grantee = 'authenticated' and table_schema = 'public' and table_name::text = 'payments'
      and privilege_type::text = 'INSERT'),
  'amount_cents,is_refund,method,note,order_id,paid_at',
  'en pagos solo se insertan esas columnas (recorded_by lo pone el servidor)');
select ok(
  not exists (select 1 from information_schema.role_column_grants
               where grantee = 'authenticated' and table_schema = 'public'
                 and table_name::text in ('orders', 'order_items', 'inventory_movements', 'profiles')
                 and privilege_type::text <> 'SELECT'),
  'pedidos, líneas, movimientos y perfiles no se escriben desde la API');

-- Storage ---------------------------------------------------------------------------------------
select is(
  (select string_agg((policyname::text || ':' || cmd::text) collate "default", ';' order by policyname::text collate "default")
     from pg_policies where schemaname = 'storage' and tablename = 'objects'),
  'product_images_admin_delete:DELETE;product_images_admin_insert:INSERT;product_images_admin_update:UPDATE',
  'storage: solo políticas de escritura para admin; nadie puede listar el bucket');
select is(
  (select (public::text || '|' || file_size_limit::text || '|' || allowed_mime_types::text) collate "default"
     from storage.buckets where id = 'product-images'),
  'true|2097152|{image/jpeg,image/png,image/webp}',
  'el bucket de imágenes limita tamaño (2 MB) y tipos');

-- Perfiles: nadie obtiene un rol al registrarse ---------------------------------------------------
select ok(
  not exists (select 1 from pg_trigger
               where tgrelid = 'auth.users'::regclass and not tgisinternal
                 and tgfoid in (select oid from pg_proc where prosrc ilike '%profiles%')),
  'no hay disparadores que creen perfiles (ni roles) al registrarse');

select * from finish();
rollback;
