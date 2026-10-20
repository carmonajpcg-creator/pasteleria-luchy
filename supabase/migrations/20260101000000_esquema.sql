-- Fase 4: esquema base de Pastelería Luchy.
-- Dinero en centavos enteros (MXN). Todo el cálculo de totales ocurre en la BD.

create type public.app_role as enum ('admin');
create type public.order_status as enum
  ('pending_contact', 'confirmed', 'in_preparation', 'ready', 'delivered', 'cancelled');
create type public.payment_status as enum ('unpaid', 'partial', 'paid', 'refunded');
create type public.fulfillment_mode as enum ('delivery', 'pickup');
create type public.product_fulfillment as enum ('stock', 'made_to_order');
create type public.payment_method as enum ('cash', 'transfer', 'other');
create type public.movement_reason as enum
  ('initial', 'production', 'purchase', 'adjustment', 'waste', 'order_confirmed', 'order_cancelled');

-- Utilidades -----------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Perfiles: el rol solo se asigna por SQL/service_role, nunca desde el cliente.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Catálogo ---------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  sku text not null unique check (char_length(sku) between 1 and 40),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  price_cents integer not null check (price_cents >= 0),
  -- Alérgenos administrables; no afirmar nada hasta verificarlo.
  allergens text[] not null default '{}',
  allergens_verified boolean not null default false,
  lead_time_hours integer not null default 0 check (lead_time_hours >= 0),
  fulfillment_type public.product_fulfillment not null default 'made_to_order',
  -- Solo se modifica mediante inventory_movements (ver RPC); sin UPDATE directo.
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  alt text not null default '',
  sort_order integer not null default 0,
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id);

-- Configuración (una sola fila) ------------------------------------------------

create table public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'Pastelería Luchy',
  -- Formato internacional sin '+' (p. ej. dígitos). Nulo hasta definirlo (CLAUDE.md §14).
  whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^[0-9]{8,15}$'),
  contact_email text,
  contact_phone text,
  schedule_text text,
  coverage_text text,
  -- Pendiente de definir; 'UTC' es un valor neutro, no una decisión de negocio.
  timezone text not null default 'UTC',
  order_expiry_hours integer not null default 48 check (order_expiry_hours > 0),
  updated_at timestamptz not null default now()
);
insert into public.store_settings default values;

-- Pedidos ----------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  public_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  idempotency_key uuid not null unique,
  status public.order_status not null default 'pending_contact',
  payment_status public.payment_status not null default 'unpaid',
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_phone text not null check (customer_phone ~ '^[0-9+() -]{8,20}$'),
  customer_email text check (customer_email is null or customer_email ~ '^[^@\s]+@[^@\s]+$'),
  fulfillment public.fulfillment_mode not null,
  requested_date date not null,
  notes text check (notes is null or char_length(notes) <= 1000),
  privacy_accepted_at timestamptz not null,
  total_cents integer not null check (total_cents >= 0),
  stock_deducted boolean not null default false,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_phone_idx on public.orders (customer_phone, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  sku text not null,
  name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 99),
  customization text check (customization is null or char_length(customization) <= 500),
  line_total_cents integer generated always as (unit_price_cents * quantity) stored,
  unique (order_id, product_id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  delta integer not null check (delta <> 0),
  reason public.movement_reason not null,
  order_id uuid references public.orders (id),
  actor uuid references auth.users (id),
  note text,
  created_at timestamptz not null default now()
);
create index inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);

create function public.block_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'La tabla % es de solo inserción', tg_table_name;
end;
$$;

create trigger inventory_movements_append_only
  before update or delete on public.inventory_movements
  for each row execute function public.block_mutation();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  amount_cents integer not null check (amount_cents > 0),
  is_refund boolean not null default false,
  method public.payment_method not null,
  note text check (note is null or char_length(note) <= 500),
  recorded_by uuid not null default auth.uid() references auth.users (id),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);

create trigger payments_append_only
  before update or delete on public.payments
  for each row execute function public.block_mutation();

-- Mantiene orders.payment_status a partir de los pagos manuales registrados.
create function public.recalc_payment_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_total integer;
  v_net integer;
  v_refunds integer;
begin
  select total_cents into v_total from public.orders where id = new.order_id for update;
  select coalesce(sum(case when is_refund then -amount_cents else amount_cents end), 0),
         coalesce(sum(amount_cents) filter (where is_refund), 0)
    into v_net, v_refunds
    from public.payments where order_id = new.order_id;
  if v_net < 0 then
    raise exception 'Los reembolsos superan lo pagado';
  end if;
  update public.orders set payment_status = case
    when v_net = 0 and v_refunds > 0 then 'refunded'::public.payment_status
    when v_net = 0 then 'unpaid'::public.payment_status
    when v_net < v_total then 'partial'::public.payment_status
    else 'paid'::public.payment_status
  end where id = new.order_id;
  return null;
end;
$$;

create trigger payments_recalc
  after insert on public.payments
  for each row execute function public.recalc_payment_status();

-- updated_at
create trigger categories_updated before update on public.categories
  for each row execute function public.set_updated_at();
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();
create trigger store_settings_updated before update on public.store_settings
  for each row execute function public.set_updated_at();
