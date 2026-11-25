-- =====================================================================
-- Retoques de la tienda (muestra para los dueños)
-- ---------------------------------------------------------------------
-- 1. store_settings: "Mostrar precio sin impuestos nacionales" (apagado
--    por defecto) y el % de impuestos (21 por defecto). Públicas para
--    leer, editables solo por admins: las policies de store_settings ya
--    existentes ("Todos: leer…" y "Admins: cambiar…", con is_admin()).
-- 2. store_products: "¡Últimas unidades!" (few_left) pasa de 1–3 a 1–2
--    unidades en total. Copia EXACTA de 20261126000001 salvo esa línea:
--    mismas columnas, en el mismo orden (lo exige create or replace view).
--
-- Compatible con el código publicado: nada se borra ni se renombra.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Precio sin impuestos nacionales
-- ---------------------------------------------------------------------
alter table public.store_settings
  add column show_price_without_taxes boolean not null default false,
  add column national_tax_percent numeric(5, 2) not null default 21
    check (national_tax_percent >= 0 and national_tax_percent < 100);

grant select (show_price_without_taxes, national_tax_percent) on public.store_settings to anon, authenticated;
grant update (show_price_without_taxes, national_tax_percent) on public.store_settings to authenticated;

-- ---------------------------------------------------------------------
-- 2. store_products: few_left = quedan 1 o 2 unidades en total
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
  vs.total_stock between 1 and 2 as few_left,
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
