-- =====================================================================
-- Subcategorías (un solo nivel)
-- ---------------------------------------------------------------------
-- 1. categories.parent_id (null = principal). Ningún producto se mueve:
--    todas las categorías actuales quedan como principales.
-- 2. Un solo nivel, con trigger (un check no puede mirar otras filas):
--      - la principal elegida tiene que ser principal;
--      - una categoría con subcategorías no puede pasar a ser subcategoría;
--      - una categoría no puede ser su propia principal (check).
-- 3. sort_order ya existe: las principales se ordenan entre sí y las
--    subcategorías dentro de su principal (reorder_categories sirve igual).
-- 4. store_products: misma definición (20261206000001_retoques_tienda.sql)
--    y mismas columnas, salvo:
--      - una subcategoría visible bajo una principal oculta también se esconde;
--      - search_text suma el nombre de la principal ("cocina" encuentra
--        los productos de Cocina › Utensilios).
--    create or replace conserva los permisos (anon/authenticated: select)
--    y security_invoker = true. Con parent_id null en todas, la tienda
--    publicada ve exactamente lo mismo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columna
-- ---------------------------------------------------------------------
alter table public.categories
  add column parent_id uuid references public.categories (id) on delete restrict,
  add constraint categories_parent_not_self check (parent_id is null or parent_id <> id);

create index categories_parent_id_idx on public.categories (parent_id);

-- ---------------------------------------------------------------------
-- 2. Un solo nivel
-- ---------------------------------------------------------------------
create or replace function public.categories_check_level()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  -- La principal elegida no puede ser, a su vez, una subcategoría.
  if exists (select 1 from public.categories c where c.id = new.parent_id and c.parent_id is not null) then
    raise exception 'subcategoria_anidada'
      using errcode = '23514', detail = 'La categoría elegida ya es una subcategoría.';
  end if;
  -- Una categoría con subcategorías no puede pasar a ser subcategoría.
  if exists (select 1 from public.categories c where c.parent_id = new.id) then
    raise exception 'categoria_con_hijas'
      using errcode = '23514', detail = 'La categoría tiene subcategorías.';
  end if;
  return new;
end;
$$;

create trigger categories_check_level
  before insert or update of parent_id on public.categories
  for each row execute function public.categories_check_level();

-- ---------------------------------------------------------------------
-- 3. store_products
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
    concat_ws(' ', p.name, c.name, pc.name, vs.barcodes)
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
-- Principal de la subcategoría (null si el producto está en una principal)
left join public.categories pc on pc.id = c.parent_id
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
  -- Categoría visible y, si es una subcategoría, su principal también.
  -- (Con security_invoker, una categoría oculta no se ve para la tienda: c/pc quedan null.)
  and (p.category_id is null or (c.is_visible and (c.parent_id is null or pc.is_visible)));
