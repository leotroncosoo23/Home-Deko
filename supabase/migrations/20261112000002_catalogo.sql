-- =====================================================================
-- Migración 2: Catálogo
-- ---------------------------------------------------------------------
-- Crea:
--   categories, products, product_options, product_option_values,
--   product_variants, variant_option_values, product_images,
--   product_costs, variant_costs
--   + secuencia y funciones del código de barras EAN-13.
--
-- Plata: numeric(12,2). Nunca float (los float redondean mal:
-- 0,1 + 0,2 da 0,30000000000000004).
-- =====================================================================

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(trim(name)) > 0),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description         text,
  -- Si se borra la categoría, el producto queda "sin categoría" (no se borra).
  category_id         uuid references public.categories (id) on delete set null,
  base_price          numeric(12,2) not null default 0 check (base_price >= 0),
  status              public.product_status not null default 'draft',
  is_featured         boolean not null default false,

  -- Descuento opcional
  discount_type       public.discount_type,
  discount_value      numeric(12,2),
  discount_starts_at  timestamptz,
  discount_ends_at    timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- O los dos vacíos o los dos cargados
  constraint products_discount_pair
    check ((discount_type is null) = (discount_value is null)),
  -- Valor positivo; si es porcentaje, como máximo 100
  constraint products_discount_value
    check (discount_value is null
           or (discount_value > 0 and (discount_type <> 'percent' or discount_value <= 100))),
  -- La fecha de fin tiene que ser posterior a la de inicio
  constraint products_discount_dates
    check (discount_starts_at is null or discount_ends_at is null
           or discount_ends_at > discount_starts_at)
);

create index products_category_id_idx on public.products (category_id);
create index products_status_idx on public.products (status);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- product_options: las "preguntas" del producto ("Color", "Medida")
-- ---------------------------------------------------------------------
create table public.product_options (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, name)
);

create index product_options_product_id_idx on public.product_options (product_id);

create trigger product_options_set_updated_at
  before update on public.product_options
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- product_option_values: las "respuestas" ("Rojo", "12x30 cm", "Ø 18")
-- ---------------------------------------------------------------------
create table public.product_option_values (
  id          uuid primary key default gen_random_uuid(),
  option_id   uuid not null references public.product_options (id) on delete cascade,
  value       text not null check (length(trim(value)) > 0),
  color_hex   text check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (option_id, value)
);

create index product_option_values_option_id_idx on public.product_option_values (option_id);

create trigger product_option_values_set_updated_at
  before update on public.product_option_values
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Código de barras EAN-13
--
-- Formato: '200' (rango de uso interno) + 9 dígitos de secuencia
--          + 1 dígito verificador = 13 dígitos.
--
-- Una secuencia de Postgres nunca entrega dos veces el mismo número,
-- aunque dos personas guarden productos al mismo tiempo.
-- (Puede dejar "huecos" si algo falla; eso no es problema.)
-- ---------------------------------------------------------------------
create sequence public.barcode_seq
  as bigint
  start with 1
  minvalue 1
  maxvalue 999999999;  -- 9 dígitos

create or replace function public.generate_ean13()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base  text;
  v_total integer := 0;
  v_digit integer;
  i       integer;
begin
  -- 12 primeros dígitos: 200 + secuencia con ceros a la izquierda
  v_base := '200' || lpad(nextval('public.barcode_seq')::text, 9, '0');

  -- Dígito verificador EAN-13:
  -- posiciones impares (1ª, 3ª, ...) valen x1, pares (2ª, 4ª, ...) valen x3.
  for i in 1..12 loop
    v_digit := substr(v_base, i, 1)::integer;
    v_total := v_total + case when i % 2 = 1 then v_digit else v_digit * 3 end;
  end loop;

  -- Ej.: 200000000001 → suma 2 + 1x3 = 5 → verificador (10 - 5) = 5
  --      → código final 2000000000015
  return v_base || ((10 - v_total % 10) % 10)::text;
end;
$$;

revoke execute on function public.generate_ean13() from public, anon, authenticated;
grant execute on function public.generate_ean13() to service_role;

-- ---------------------------------------------------------------------
-- product_variants: cada combinación vendible. Acá vive el stock.
-- ---------------------------------------------------------------------
create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  sku         text unique check (sku is null or length(trim(sku)) > 0),
  barcode     text not null unique check (barcode ~ '^[0-9]{13}$'),
  price       numeric(12,2) check (price is null or price >= 0),  -- vacío = usa base_price
  stock       integer not null default 0 check (stock >= 0),
  min_stock   integer not null default 0 check (min_stock >= 0),
  is_default  boolean not null default false,
  is_active   boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index product_variants_product_id_idx on public.product_variants (product_id);
-- Como máximo UNA variante por defecto por producto
create unique index product_variants_one_default_idx
  on public.product_variants (product_id) where is_default;

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

-- Al crear una variante, la base SIEMPRE le pone su código
-- (ignora cualquier valor que mande la app).
create or replace function public.set_variant_barcode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.barcode := public.generate_ean13();
  return new;
end;
$$;

create trigger product_variants_set_barcode
  before insert on public.product_variants
  for each row execute function public.set_variant_barcode();

-- Un código de barras nunca cambia una vez creado.
create or replace function public.protect_variant_barcode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.barcode is distinct from old.barcode then
    raise exception 'El código de barras no se puede modificar';
  end if;
  return new;
end;
$$;

create trigger product_variants_protect_barcode
  before update on public.product_variants
  for each row execute function public.protect_variant_barcode();

-- ---------------------------------------------------------------------
-- variant_option_values: tabla puente variante <-> valores.
-- La variante "Rojo / 300 ml" tiene 2 filas acá: una a "Rojo" y otra
-- a "300 ml". Es una relación "muchos a muchos".
-- ---------------------------------------------------------------------
create table public.variant_option_values (
  variant_id       uuid not null references public.product_variants (id) on delete cascade,
  option_value_id  uuid not null references public.product_option_values (id) on delete cascade,
  primary key (variant_id, option_value_id)
);

create index variant_option_values_option_value_id_idx
  on public.variant_option_values (option_value_id);

-- ---------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------
create table public.product_images (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products (id) on delete cascade,
  storage_path     text not null unique,  -- ej.: <product_id>/<archivo>.webp
  alt_text         text,
  position         integer not null default 0,
  is_primary       boolean not null default false,
  -- Opcional: la foto corresponde a un color ("Rojo")
  option_value_id  uuid references public.product_option_values (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index product_images_product_id_idx on public.product_images (product_id);
create index product_images_option_value_id_idx on public.product_images (option_value_id);
-- Como máximo UNA imagen principal por producto
create unique index product_images_one_primary_idx
  on public.product_images (product_id) where is_primary;

create trigger product_images_set_updated_at
  before update on public.product_images
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Costos (SOLO admins). Van en tablas aparte porque RLS filtra filas,
-- no columnas: si el costo estuviera en products, quien pudiera leer el
-- producto podría leer también el costo.
--
-- product_costs → costo general del producto (respaldo).
-- variant_costs → costo específico de una variante. Si no hay fila,
--                 se usa el del producto.
-- ---------------------------------------------------------------------
create table public.product_costs (
  product_id  uuid primary key references public.products (id) on delete cascade,
  cost_price  numeric(12,2) not null check (cost_price >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger product_costs_set_updated_at
  before update on public.product_costs
  for each row execute function public.set_updated_at();

create table public.variant_costs (
  variant_id  uuid primary key references public.product_variants (id) on delete cascade,
  cost_price  numeric(12,2) not null check (cost_price >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger variant_costs_set_updated_at
  before update on public.variant_costs
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Seguridad (GRANT + RLS)
--
-- Patrón de las policies:
--   * Tienda (anon y clientes): solo lee lo que pertenece a productos
--     con status = 'active'.
--   * Admins: ven y modifican todo.
--
-- "(select public.is_admin())" entre paréntesis hace que Postgres la
-- calcule una sola vez por consulta y no una vez por fila (más rápido).
-- =====================================================================

-- categories ----------------------------------------------------------
alter table public.categories enable row level security;

revoke all on public.categories from anon, authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;

create policy "Todos: ver categorías"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "Admins: crear categorías"
  on public.categories for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins: editar categorías"
  on public.categories for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins: borrar categorías"
  on public.categories for delete to authenticated
  using ((select public.is_admin()));

-- products ------------------------------------------------------------
alter table public.products enable row level security;

revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;

create policy "Tienda: productos publicados; admins: todos"
  on public.products for select
  to anon, authenticated
  using (status = 'active' or (select public.is_admin()));

create policy "Admins: crear productos"
  on public.products for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins: editar productos"
  on public.products for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins: borrar productos"
  on public.products for delete to authenticated
  using ((select public.is_admin()));

-- product_options -----------------------------------------------------
alter table public.product_options enable row level security;

revoke all on public.product_options from anon, authenticated;
grant select on public.product_options to anon, authenticated;
grant insert, update, delete on public.product_options to authenticated;
grant all on public.product_options to service_role;

create policy "Tienda: opciones de productos publicados; admins: todas"
  on public.product_options for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_options.product_id and p.status = 'active'
    )
    or (select public.is_admin())
  );

create policy "Admins: crear opciones"
  on public.product_options for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins: editar opciones"
  on public.product_options for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins: borrar opciones"
  on public.product_options for delete to authenticated
  using ((select public.is_admin()));

-- product_option_values -----------------------------------------------
alter table public.product_option_values enable row level security;

revoke all on public.product_option_values from anon, authenticated;
grant select on public.product_option_values to anon, authenticated;
grant insert, update, delete on public.product_option_values to authenticated;
grant all on public.product_option_values to service_role;

create policy "Tienda: valores de productos publicados; admins: todos"
  on public.product_option_values for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.product_options o
      join public.products p on p.id = o.product_id
      where o.id = product_option_values.option_id and p.status = 'active'
    )
    or (select public.is_admin())
  );

create policy "Admins: crear valores"
  on public.product_option_values for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins: editar valores"
  on public.product_option_values for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins: borrar valores"
  on public.product_option_values for delete to authenticated
  using ((select public.is_admin()));

-- product_variants ----------------------------------------------------
-- GRANT por columna: los admins pueden escribir todo MENOS stock y
-- barcode. Aunque alguien intente "update stock = 999" desde el
-- navegador, la base lo rechaza. El stock solo cambia con adjust_stock().
alter table public.product_variants enable row level security;

revoke all on public.product_variants from anon, authenticated;
grant select on public.product_variants to anon, authenticated;
grant insert (product_id, sku, price, min_stock, is_default, is_active, position)
  on public.product_variants to authenticated;
grant update (sku, price, min_stock, is_default, is_active, position)
  on public.product_variants to authenticated;
grant delete on public.product_variants to authenticated;
grant all on public.product_variants to service_role;

create policy "Tienda: variantes de productos publicados; admins: todas"
  on public.product_variants for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.status = 'active'
    )
    or (select public.is_admin())
  );

create policy "Admins: crear variantes"
  on public.product_variants for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins: editar variantes"
  on public.product_variants for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins: borrar variantes"
  on public.product_variants for delete to authenticated
  using ((select public.is_admin()));

-- variant_option_values -----------------------------------------------
alter table public.variant_option_values enable row level security;

revoke all on public.variant_option_values from anon, authenticated;
grant select on public.variant_option_values to anon, authenticated;
grant insert, delete on public.variant_option_values to authenticated;
grant all on public.variant_option_values to service_role;

create policy "Tienda: combinaciones de productos publicados; admins: todas"
  on public.variant_option_values for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_option_values.variant_id and p.status = 'active'
    )
    or (select public.is_admin())
  );

create policy "Admins: crear combinaciones"
  on public.variant_option_values for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins: borrar combinaciones"
  on public.variant_option_values for delete to authenticated
  using ((select public.is_admin()));

-- product_images ------------------------------------------------------
alter table public.product_images enable row level security;

revoke all on public.product_images from anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;
grant all on public.product_images to service_role;

create policy "Tienda: imágenes de productos publicados; admins: todas"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.status = 'active'
    )
    or (select public.is_admin())
  );

create policy "Admins: crear imágenes"
  on public.product_images for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins: editar imágenes"
  on public.product_images for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins: borrar imágenes"
  on public.product_images for delete to authenticated
  using ((select public.is_admin()));

-- product_costs (solo admins: anon no tiene ni grant) -------------------
alter table public.product_costs enable row level security;

revoke all on public.product_costs from anon, authenticated;
grant select, insert, update, delete on public.product_costs to authenticated;
grant all on public.product_costs to service_role;

create policy "Admins: todo sobre costos de producto"
  on public.product_costs for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- variant_costs (solo admins) -----------------------------------------
alter table public.variant_costs enable row level security;

revoke all on public.variant_costs from anon, authenticated;
grant select, insert, update, delete on public.variant_costs to authenticated;
grant all on public.variant_costs to service_role;

create policy "Admins: todo sobre costos de variante"
  on public.variant_costs for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- La secuencia del código de barras solo la usa la base (vía funciones).
revoke all on sequence public.barcode_seq from anon, authenticated;
grant usage, select on sequence public.barcode_seq to service_role;
