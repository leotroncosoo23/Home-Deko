-- =====================================================================
-- Migración: página de producto y carrito (paso 3)
-- ---------------------------------------------------------------------
-- 1. store_products: dos columnas nuevas AL FINAL (así lo exige
--    "create or replace view"), para el botón rápido de la tarjeta:
--      variant_count     → cuántas variantes activas tiene
--      single_variant_id → la variante, si tiene UNA sola (si no, null)
--
-- 2. Vista store_variants: una fila por variante activa de un producto
--    que se ve en la tienda, con su precio final (descuento incluido).
--    Es la ÚNICA fuente del precio por variante para la tienda: la usan
--    la página de producto, el carrito y (paso 4) el checkout.
--    Se apoya en store_products, así que respeta lo mismo: categoría
--    oculta, archivados y borradores (estos solo para admins, por RLS).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. store_products (igual que antes + 2 columnas al final)
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
  fp.final_min_price,
  d.discount_active,
  vs.min_price <> vs.max_price as has_price_range,
  vs.in_stock,
  img.storage_path as primary_image_path,
  img.alt_text as primary_image_alt,
  p.created_at,
  img2.storage_path as secondary_image_path,
  lower(extensions.unaccent(
    'extensions.unaccent'::regdictionary,
    concat_ws(' ', p.name, c.name, vs.barcodes)
  )) as search_text,
  case
    when d.discount_active and vs.min_price > 0
      then round(100 * (vs.min_price - fp.final_min_price) / vs.min_price)::integer
  end as discount_percent_max,
  case
    when d.discount_active and vs.max_price > 0
      then round(100 * (vs.max_price - fp.final_max_price) / vs.max_price)::integer
  end as discount_percent_min,
  vs.total_stock between 1 and 3 as few_left,
  -- (nuevas, al final)
  vs.variant_count,
  vs.single_variant_id
from public.products p
left join public.categories c on c.id = p.category_id
cross join lateral (
  select
    coalesce(min(coalesce(pv.price, p.base_price)), p.base_price) as min_price,
    coalesce(max(coalesce(pv.price, p.base_price)), p.base_price) as max_price,
    coalesce(bool_or(pv.stock > 0), false) as in_stock,
    coalesce(sum(pv.stock), 0) as total_stock,
    string_agg(pv.barcode, ' ') as barcodes,
    count(pv.id)::integer as variant_count,
    case when count(pv.id) = 1 then (array_agg(pv.id))[1] end as single_variant_id
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
cross join lateral (
  select
    case
      when not d.discount_active then vs.min_price
      when p.discount_type = 'percent' then round(vs.min_price * (1 - p.discount_value / 100), 2)
      else greatest(vs.min_price - p.discount_value, 0)
    end as final_min_price,
    case
      when not d.discount_active then vs.max_price
      when p.discount_type = 'percent' then round(vs.max_price * (1 - p.discount_value / 100), 2)
      else greatest(vs.max_price - p.discount_value, 0)
    end as final_max_price
) fp
left join lateral (
  select pi.storage_path, pi.alt_text
  from public.product_images pi
  where pi.product_id = p.id
  order by pi.is_primary desc, pi.position
  limit 1
) img on true
left join lateral (
  select pi.storage_path
  from public.product_images pi
  where pi.product_id = p.id
  order by pi.is_primary desc, pi.position
  offset 1
  limit 1
) img2 on true
where p.status <> 'archived'
  and (p.category_id is null or c.is_visible);

revoke all on public.store_products from public, anon, authenticated;
grant select on public.store_products to anon, authenticated;
grant select on public.store_products to service_role;

-- ---------------------------------------------------------------------
-- 2. store_variants
--
-- price       = precio propio de la variante o el precio base del producto
-- final_price = con el descuento del producto si HOY está vigente
--               (misma regla que store_products y admin_products)
-- ---------------------------------------------------------------------
create view public.store_variants
with (security_invoker = true)
as
select
  pv.id as variant_id,
  pv.product_id,
  coalesce(pv.price, p.base_price) as price,
  case
    when not sp.discount_active then coalesce(pv.price, p.base_price)
    when p.discount_type = 'percent' then round(coalesce(pv.price, p.base_price) * (1 - p.discount_value / 100), 2)
    else greatest(coalesce(pv.price, p.base_price) - p.discount_value, 0)
  end as final_price,
  pv.stock,
  pv.position,
  pv.is_default
from public.product_variants pv
-- store_products ya filtra archivados y categorías ocultas (y el RLS, borradores)
join public.store_products sp on sp.id = pv.product_id
join public.products p on p.id = pv.product_id
where pv.is_active;

revoke all on public.store_variants from public, anon, authenticated;
grant select on public.store_variants to anon, authenticated;
grant select on public.store_variants to service_role;
