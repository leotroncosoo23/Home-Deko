-- =====================================================================
-- Migración: Listado de productos del panel (paso 6)
-- ---------------------------------------------------------------------
-- 1. Extensión unaccent: buscar sin tildes ("ceramica" → "Cerámica").
-- 2. Vista admin_products: una fila por producto con lo que necesita el
--    listado ya calculado (stock total, estado de stock, precios con
--    descuento, foto principal, texto de búsqueda…), para poder filtrar,
--    ordenar y paginar EN LA BASE.
-- 3. Función delete_product(id): "eliminar definitivamente", solo si el
--    producto nunca tuvo movimientos de stock además del "inicial".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. unaccent (en el esquema "extensions", como recomienda Supabase)
-- ---------------------------------------------------------------------
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- 2. Vista admin_products
--
-- Una vista es una consulta guardada que se usa como si fuera una tabla.
--
-- Seguridad:
--   * security_invoker = true → corre con los permisos de QUIEN consulta,
--     así que aplica el RLS de cada tabla (como si consultara las tablas).
--   * where is_admin() → un usuario que no es admin recibe 0 filas.
--   * Solo "authenticated" puede consultarla (los visitantes, no).
--
-- Reglas:
--   * Solo cuentan las variantes ACTIVAS (las desactivadas guardan historial).
--   * stock_status:
--       'out' → no queda nada (todas las variantes activas en 0)
--       'low' → queda algo, pero alguna variante está en su mínimo o menos
--               (o en 0): hay que reponer
--       'ok'  → todo bien
--   * El descuento solo cuenta si HOY está vigente (según sus fechas).
-- ---------------------------------------------------------------------
create or replace view public.admin_products
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.slug,
  p.status,
  p.is_featured,
  p.category_id,
  c.name as category_name,
  p.base_price,
  p.discount_type,
  p.discount_value,
  p.discount_starts_at,
  p.discount_ends_at,
  d.discount_active,
  vs.variant_count,
  vs.has_variants,
  vs.total_stock,
  case
    when vs.total_stock = 0 then 'out'
    when vs.any_low then 'low'
    else 'ok'
  end as stock_status,
  vs.min_price,
  vs.max_price,
  -- Precio final (con descuento si está vigente), redondeado a centavos
  case
    when not d.discount_active then vs.min_price
    when p.discount_type = 'percent' then round(vs.min_price * (1 - p.discount_value / 100), 2)
    else greatest(vs.min_price - p.discount_value, 0)
  end as final_min_price,
  case
    when not d.discount_active then vs.max_price
    when p.discount_type = 'percent' then round(vs.max_price * (1 - p.discount_value / 100), 2)
    else greatest(vs.max_price - p.discount_value, 0)
  end as final_max_price,
  img.storage_path as primary_image_path,
  hist.has_history,
  -- Texto de búsqueda: nombre + SKU + códigos de barras (de TODAS las
  -- variantes, así una etiqueta vieja también encuentra el producto),
  -- en minúsculas y sin tildes.
  lower(extensions.unaccent(
    'extensions.unaccent'::regdictionary,
    concat_ws(' ', p.name, codes.skus, codes.barcodes)
  )) as search_text,
  p.created_at,
  p.updated_at
from public.products p
left join public.categories c on c.id = p.category_id
-- Variantes activas: cantidad, stock, precios
cross join lateral (
  select
    count(*)::integer as variant_count,
    coalesce(sum(pv.stock), 0)::integer as total_stock,
    coalesce(bool_or(pv.stock = 0 or pv.stock <= pv.min_stock), false) as any_low,
    coalesce(min(coalesce(pv.price, p.base_price)), p.base_price) as min_price,
    coalesce(max(coalesce(pv.price, p.base_price)), p.base_price) as max_price,
    -- "Sin variantes" = una sola variante, la de por defecto
    not (count(*) = 1 and coalesce(bool_and(pv.is_default), false)) as has_variants
  from public.product_variants pv
  where pv.product_id = p.id and pv.is_active
) vs
-- ¿El descuento está vigente hoy?
cross join lateral (
  select (
    p.discount_type is not null
    and (p.discount_starts_at is null or p.discount_starts_at <= now())
    and (p.discount_ends_at is null or p.discount_ends_at >= now())
  ) as discount_active
) d
-- Foto principal (o la primera)
left join lateral (
  select pi.storage_path
  from public.product_images pi
  where pi.product_id = p.id
  order by pi.is_primary desc, pi.position
  limit 1
) img on true
-- ¿Tuvo movimientos de stock además del "inicial"? (ventas, ajustes…)
cross join lateral (
  select exists (
    select 1
    from public.stock_movements sm
    join public.product_variants pv on pv.id = sm.variant_id
    where pv.product_id = p.id and sm.reason <> 'inicial'
  ) as has_history
) hist
-- SKU y códigos de todas las variantes, para buscar
cross join lateral (
  select
    string_agg(pv.sku, ' ') as skus,
    string_agg(pv.barcode, ' ') as barcodes
  from public.product_variants pv
  where pv.product_id = p.id
) codes
where (select public.is_admin());

revoke all on public.admin_products from public, anon, authenticated;
grant select on public.admin_products to authenticated;
grant select on public.admin_products to service_role;

-- ---------------------------------------------------------------------
-- 3. delete_product(id): eliminar definitivamente
--
-- Es SECURITY DEFINER (corre con permisos del dueño) porque tiene que
-- borrar los movimientos "inicial", y el historial de stock no se puede
-- borrar por ningún otro camino (la tabla solo admite agregar). Por eso:
--   * valida is_admin() ADENTRO, antes de hacer nada (auth.uid() sigue
--     siendo el usuario que llama, aunque la función corra como dueño);
--   * search_path vacío y nombres con esquema;
--   * solo borra movimientos "inicial", y solo de un producto que no
--     tiene NINGÚN otro movimiento (ni ventas, ni ajustes, ni roturas).
--
-- Devuelve { id, image_paths } para que la app borre las fotos de Storage.
-- ---------------------------------------------------------------------
create or replace function public.delete_product(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text;
  v_paths text[];
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para eliminar productos' using errcode = '42501';
  end if;

  -- Bloquear el producto y sus variantes hasta terminar: si justo alguien
  -- registra una venta (adjust_stock), espera, y no se borra nada a medias.
  select pr.name into v_name from public.products pr where pr.id = p_id for update;
  if not found then
    raise exception 'Este producto ya no existe.' using errcode = 'HD404';
  end if;
  perform 1 from public.product_variants pv where pv.product_id = p_id for update;

  if exists (
    select 1
    from public.stock_movements sm
    join public.product_variants pv on pv.id = sm.variant_id
    where pv.product_id = p_id and sm.reason <> 'inicial'
  ) then
    raise exception 'No se puede eliminar «%» porque tiene historial de stock (ventas o ajustes). Podés archivarlo: deja de verse en la tienda y se conserva el historial.', v_name
      using errcode = 'HD422';
  end if;

  select coalesce(array_agg(pi.storage_path), '{}')
    into v_paths
    from public.product_images pi
   where pi.product_id = p_id;

  -- Primero los movimientos "inicial" (frenan el borrado de las variantes)…
  delete from public.stock_movements sm
   using public.product_variants pv
   where pv.id = sm.variant_id and pv.product_id = p_id and sm.reason = 'inicial';

  -- …y después el producto: opciones, variantes, fotos y costos se borran
  -- en cascada.
  delete from public.products where id = p_id;

  return jsonb_build_object('id', p_id, 'image_paths', to_jsonb(v_paths));
end;
$$;

revoke execute on function public.delete_product(uuid) from public, anon;
grant execute on function public.delete_product(uuid) to authenticated, service_role;
