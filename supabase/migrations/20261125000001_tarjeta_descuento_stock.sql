-- =====================================================================
-- Migración: datos para la tarjeta de producto (porcentaje de descuento
-- y "¡Últimas unidades!")
-- ---------------------------------------------------------------------
-- Se rehace la vista store_products. Las columnas existentes quedan igual
-- y las nuevas van AL FINAL (así lo exige "create or replace view"):
--
-- 1. discount_percent_max / discount_percent_min: el porcentaje de
--    descuento vigente, redondeado, de la variante que más ahorra y de la
--    que menos. Con descuento en %, son iguales. Con monto fijo y
--    variantes de distinto precio, la más barata ahorra más en % → la
--    tarjeta muestra "Hasta -20%". Sin descuento vigente: null.
--      max = sobre el precio más bajo  (min_price → final_min_price)
--      min = sobre el precio más alto  (max_price → final_max_price)
--
-- 2. few_left: quedan entre 1 y 3 unidades EN TOTAL (sumando las variantes
--    activas) → "¡Últimas unidades!". Es un sí/no a propósito: la tienda
--    no muestra cuántas unidades hay. El umbral (3) está acá.
-- =====================================================================

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
  -- (nuevas, al final)
  case
    when d.discount_active and vs.min_price > 0
      then round(100 * (vs.min_price - fp.final_min_price) / vs.min_price)::integer
  end as discount_percent_max,
  case
    when d.discount_active and vs.max_price > 0
      then round(100 * (vs.max_price - fp.final_max_price) / vs.max_price)::integer
  end as discount_percent_min,
  vs.total_stock between 1 and 3 as few_left
from public.products p
-- Nombre de la categoría (para buscar). Con security_invoker, un
-- visitante solo "ve" las categorías visibles (RLS de categories).
left join public.categories c on c.id = p.category_id
cross join lateral (
  select
    coalesce(min(coalesce(pv.price, p.base_price)), p.base_price) as min_price,
    coalesce(max(coalesce(pv.price, p.base_price)), p.base_price) as max_price,
    coalesce(bool_or(pv.stock > 0), false) as in_stock,
    coalesce(sum(pv.stock), 0) as total_stock,
    string_agg(pv.barcode, ' ') as barcodes
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
-- Precios finales (con el descuento si está vigente): misma regla de siempre
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
-- Foto principal (o la primera)
left join lateral (
  select pi.storage_path, pi.alt_text
  from public.product_images pi
  where pi.product_id = p.id
  order by pi.is_primary desc, pi.position
  limit 1
) img on true
-- Segunda foto (la que sigue en el mismo orden)
left join lateral (
  select pi.storage_path
  from public.product_images pi
  where pi.product_id = p.id
  order by pi.is_primary desc, pi.position
  offset 1
  limit 1
) img2 on true
where p.status <> 'archived'
  -- Categoría oculta → el producto no se ve en la tienda.
  and (p.category_id is null or c.is_visible);

revoke all on public.store_products from public, anon, authenticated;
grant select on public.store_products to anon, authenticated;
grant select on public.store_products to service_role;
