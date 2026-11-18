-- =====================================================================
-- Migración: Inicio de la tienda (paso 1)
-- ---------------------------------------------------------------------
-- 1. Tabla banners: el banner principal del inicio, editable desde el
--    panel (sección "Banner"). Puede haber varios programados; la tienda
--    muestra UNO: el activo y vigente que empezó más recientemente.
-- 2. Vista store_products: los datos de un producto que necesita la
--    tienda para mostrar una tarjeta (sin costos, sin códigos, sin stock
--    numérico). Los visitantes ven solo los publicados; los admins,
--    además, los borradores (para la vista previa).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. banners
-- ---------------------------------------------------------------------
create table public.banners (
  id                  uuid primary key default gen_random_uuid(),

  -- 'template': plantilla de marca (título, texto, botón, foto, fondo)
  -- 'image':    una imagen completa diseñada aparte
  kind                text not null check (kind in ('template', 'image')),

  -- En las imágenes completas, el título es el texto alternativo
  -- (lo lee el lector de pantalla). Obligatorio en los dos tipos.
  title               text not null check (length(trim(title)) > 0 and char_length(title) <= 80),
  body                text check (body is null or char_length(body) <= 200),
  button_label        text check (button_label is null or (length(trim(button_label)) > 0 and char_length(button_label) <= 30)),
  -- Link interno ("/productos") o externo seguro ("https://…")
  button_url          text check (button_url is null or (char_length(button_url) <= 500 and button_url ~ '^(/[^/]|/$|https://)')),
  background          text not null default 'red' check (background in ('red', 'white')),

  -- Rutas en Storage (bucket product-images, carpeta banners/)
  product_image_path  text check (product_image_path is null or product_image_path like 'banners/%'),
  image_path          text check (image_path is null or image_path like 'banners/%'),
  image_mobile_path   text check (image_mobile_path is null or image_mobile_path like 'banners/%'),

  -- Fechas opcionales: sin inicio = desde ya; sin fin = sin vencimiento.
  -- El panel guarda 00:00 de Argentina del día de inicio y 00:00 del día
  -- SIGUIENTE al de fin (así el último día se ve completo).
  starts_at           timestamptz,
  ends_at             timestamptz,
  -- Pausar a mano sin borrar.
  is_active           boolean not null default true,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Botón: texto y link van juntos (o ninguno)
  constraint banners_button_pair check ((button_label is null) = (button_url is null)),
  -- La imagen completa necesita su imagen
  constraint banners_image_required check (kind <> 'image' or image_path is not null),
  constraint banners_dates check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index banners_schedule_idx on public.banners (is_active, starts_at, ends_at);

create trigger banners_set_updated_at
  before update on public.banners
  for each row execute function public.set_updated_at();

alter table public.banners enable row level security;

revoke all on public.banners from public, anon, authenticated;
grant select on public.banners to anon, authenticated;
grant insert, update, delete on public.banners to authenticated;
grant all on public.banners to service_role;

-- La tienda solo ve los banners activos y dentro de sus fechas.
-- Así se "prende y apaga solo": no hace falta ninguna tarea programada.
create policy "Tienda: banners vigentes; admins: todos"
  on public.banners for select
  to anon, authenticated
  using (
    (
      is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    )
    or (select public.is_admin())
  );

create policy "Admins: crear banners"
  on public.banners for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins: editar banners"
  on public.banners for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins: borrar banners"
  on public.banners for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 2. store_products
--
-- security_invoker = true → aplica el RLS de cada tabla según QUIEN
-- consulta: un visitante solo recibe productos 'active' (policy de
-- products) y un admin también los 'draft'. Los archivados no salen
-- nunca (filtro de abajo).
--
-- Precio: el mínimo de las variantes activas (o el precio base), con el
-- descuento aplicado si HOY está vigente (misma regla que admin_products).
-- ---------------------------------------------------------------------
create or replace view public.store_products
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.slug,
  p.status,
  p.is_featured,
  p.category_id,
  vs.min_price,
  case
    when not d.discount_active then vs.min_price
    when p.discount_type = 'percent' then round(vs.min_price * (1 - p.discount_value / 100), 2)
    else greatest(vs.min_price - p.discount_value, 0)
  end as final_min_price,
  d.discount_active,
  vs.min_price <> vs.max_price as has_price_range,
  vs.in_stock,
  img.storage_path as primary_image_path,
  img.alt_text as primary_image_alt,
  p.created_at
from public.products p
cross join lateral (
  select
    coalesce(min(coalesce(pv.price, p.base_price)), p.base_price) as min_price,
    coalesce(max(coalesce(pv.price, p.base_price)), p.base_price) as max_price,
    coalesce(bool_or(pv.stock > 0), false) as in_stock
  from public.product_variants pv
  where pv.product_id = p.id and pv.is_active
) vs
cross join lateral (
  select (
    p.discount_type is not null
    and (p.discount_starts_at is null or p.discount_starts_at <= now())
    and (p.discount_ends_at is null or p.discount_ends_at >= now())
  ) as discount_active
) d
left join lateral (
  select pi.storage_path, pi.alt_text
  from public.product_images pi
  where pi.product_id = p.id
  order by pi.is_primary desc, pi.position
  limit 1
) img on true
where p.status <> 'archived';

revoke all on public.store_products from public, anon, authenticated;
grant select on public.store_products to anon, authenticated;
grant select on public.store_products to service_role;
