-- =====================================================================
-- Migración: Catálogo de la tienda (paso 2)
-- ---------------------------------------------------------------------
-- Se rehace la vista store_products (la que lee la tienda) con tres
-- cambios. Las columnas que ya existían quedan igual; las nuevas van AL
-- FINAL (así lo exige "create or replace view").
--
-- 1. secondary_image_path: la segunda foto, que aparece al pasar el
--    mouse por la tarjeta.
-- 2. search_text: texto para el buscador de la tienda = nombre +
--    categoría + códigos de barras de las variantes activas, en
--    minúsculas y SIN TILDES ("sabana" encuentra "Sábana"). La app
--    normaliza igual lo que escribe el cliente y busca con ilike.
--    Los códigos de barras ya eran legibles por "anon" (grant de
--    product_variants): no se expone nada nuevo.
-- 3. Categoría oculta → sus productos NO se ven en la tienda (catálogo,
--    búsqueda, destacados del inicio y página de producto). Los
--    productos sin categoría se siguen viendo.
--
-- Sin índice: la tienda tiene cientos de productos y el filtro es
-- instantáneo. Si algún día fueran decenas de miles, pasar search_text a
-- una columna guardada con un índice trigram.
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
  p.created_at,
  -- (nuevas, al final)
  img2.storage_path as secondary_image_path,
  lower(extensions.unaccent(
    'extensions.unaccent'::regdictionary,
    concat_ws(' ', p.name, c.name, vs.barcodes)
  )) as search_text
from public.products p
-- Nombre de la categoría (para buscar). Con security_invoker, un
-- visitante solo "ve" las categorías visibles (RLS de categories).
left join public.categories c on c.id = p.category_id
cross join lateral (
  select
    coalesce(min(coalesce(pv.price, p.base_price)), p.base_price) as min_price,
    coalesce(max(coalesce(pv.price, p.base_price)), p.base_price) as max_price,
    coalesce(bool_or(pv.stock > 0), false) as in_stock,
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
  -- Categoría oculta → el producto no se ve en la tienda (ni siquiera en
  -- la vista previa de los admins: lo oculto se revisa en el panel).
  -- Se pregunta "c.is_visible" explícito porque un admin ve todas.
  and (p.category_id is null or c.is_visible);

-- Los permisos no cambian con "create or replace", pero se repiten por claridad.
revoke all on public.store_products from public, anon, authenticated;
grant select on public.store_products to anon, authenticated;
grant select on public.store_products to service_role;
