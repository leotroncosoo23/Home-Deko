-- =====================================================================
-- Migración: Ajuste de stock e historial (paso 7)
-- ---------------------------------------------------------------------
-- adjust_stock() sigue siendo el ÚNICO camino para cambiar el stock.
-- Esta migración agrega:
--   1. Vista admin_variant_stock: una fila por variante (para el ingreso
--      rápido, "Para reponer" y el contador de la barra lateral).
--   2. Vista admin_stock_movements: el historial con todo resuelto
--      (producto, variante, quién lo hizo).
--   3. count_stock(): corrección por conteo ("hay 7"), calculada en la base.
--   4. Índice por fecha para el historial general.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. admin_variant_stock
--
-- Solo variantes ACTIVAS de productos NO archivados (borradores sí: el
-- stock del local se vende aunque el producto no esté publicado).
--
-- stock_status (misma regla que el listado de productos, pero por variante):
--   'out' → en 0
--   'low' → en su stock mínimo o menos
--   'ok'  → bien
--
-- Seguridad: security_invoker (aplica el RLS de quien consulta) +
-- is_admin() (un cliente recibe 0 filas) + solo "authenticated".
-- ---------------------------------------------------------------------
create or replace view public.admin_variant_stock
with (security_invoker = true)
as
select
  pv.id as variant_id,
  p.id as product_id,
  p.name as product_name,
  p.status as product_status,
  c.name as category_name,
  lbl.label as variant_label,          -- "Rojo / 300 ml" (null en un producto sin variantes)
  pv.is_default,
  pv.sku,
  pv.barcode,
  pv.stock,
  pv.min_stock,
  case
    when pv.stock = 0 then 'out'
    when pv.stock <= pv.min_stock then 'low'
    else 'ok'
  end as stock_status,
  img.storage_path as image_path,
  -- Para buscar: producto + variante + SKU + código, sin tildes
  lower(extensions.unaccent(
    'extensions.unaccent'::regdictionary,
    concat_ws(' ', p.name, lbl.label, pv.sku, pv.barcode)
  )) as search_text,
  pv.position,
  p.updated_at as product_updated_at
from public.product_variants pv
join public.products p on p.id = pv.product_id
left join public.categories c on c.id = p.category_id
-- Nombre de la variante: sus valores en el orden de las opciones
left join lateral (
  select string_agg(pov.value, ' / ' order by po.position) as label
  from public.variant_option_values vov
  join public.product_option_values pov on pov.id = vov.option_value_id
  join public.product_options po on po.id = pov.option_id
  where vov.variant_id = pv.id
) lbl on true
-- Foto: la del color de esta variante si hay; si no, la principal
left join lateral (
  select pi.storage_path
  from public.product_images pi
  where pi.product_id = p.id
  order by
    (pi.option_value_id is not null and exists (
      select 1 from public.variant_option_values vov
      where vov.variant_id = pv.id and vov.option_value_id = pi.option_value_id
    )) desc,
    pi.is_primary desc,
    pi.position
  limit 1
) img on true
where pv.is_active
  and p.status <> 'archived'
  and (select public.is_admin());

revoke all on public.admin_variant_stock from public, anon, authenticated;
grant select on public.admin_variant_stock to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. admin_stock_movements: el historial "listo para mostrar"
--
-- Incluye todo (también productos archivados y variantes desactivadas:
-- el historial no se pierde nunca).
-- author_name: nombre del perfil, o su email; null = lo hizo el sistema
-- (ej.: el webhook de Mercado Pago, más adelante).
-- ---------------------------------------------------------------------
create or replace view public.admin_stock_movements
with (security_invoker = true)
as
select
  sm.id,
  sm.created_at,
  sm.variant_id,
  pv.product_id,
  p.name as product_name,
  lbl.label as variant_label,
  pv.sku,
  pv.barcode,
  sm.reason,
  sm.quantity,
  sm.stock_after,
  sm.note,
  sm.order_id,
  sm.created_by,
  coalesce(nullif(trim(pr.full_name), ''), pr.email) as author_name,
  lower(extensions.unaccent(
    'extensions.unaccent'::regdictionary,
    concat_ws(' ', p.name, lbl.label, pv.sku, pv.barcode)
  )) as search_text
from public.stock_movements sm
join public.product_variants pv on pv.id = sm.variant_id
join public.products p on p.id = pv.product_id
left join public.profiles pr on pr.id = sm.created_by
left join lateral (
  select string_agg(pov.value, ' / ' order by po.position) as label
  from public.variant_option_values vov
  join public.product_option_values pov on pov.id = vov.option_value_id
  join public.product_options po on po.id = pov.option_id
  where vov.variant_id = pv.id
) lbl on true
where (select public.is_admin());

revoke all on public.admin_stock_movements from public, anon, authenticated;
grant select on public.admin_stock_movements to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. count_stock(variante, contado, nota): corrección por conteo
--
-- La persona dice "hay 7". La diferencia se calcula ACÁ, con el stock
-- real en este momento (bloqueando la variante), y no en la pantalla:
-- si justo entre medio se vendió algo, la cuenta igual da bien.
-- Después registra el movimiento con adjust_stock(…, 'ajuste') (que
-- además vuelve a comprobar que quien llama sea admin).
--
-- Si el conteo coincide con el stock, no registra nada.
-- Devuelve { previous, new, difference }.
--
-- Corre con los permisos de quien la llama (security invoker).
-- ---------------------------------------------------------------------
create or replace function public.count_stock(
  p_variant_id uuid,
  p_counted    integer,
  p_note       text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_stock integer;
  v_new   integer;
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para ajustar stock' using errcode = '42501';
  end if;
  if p_counted is null or p_counted < 0 then
    raise exception 'El stock contado no puede ser negativo' using errcode = 'HD422';
  end if;

  -- Stock real en este momento, bloqueando la fila hasta terminar
  select pv.stock into v_stock
    from public.product_variants pv
   where pv.id = p_variant_id
   for update;
  if not found then
    raise exception 'La variante no existe' using errcode = 'HD404';
  end if;

  if p_counted = v_stock then
    return jsonb_build_object('previous', v_stock, 'new', v_stock, 'difference', 0);
  end if;

  v_new := public.adjust_stock(p_variant_id, p_counted - v_stock, 'ajuste'::public.stock_reason, p_note);
  return jsonb_build_object('previous', v_stock, 'new', v_new, 'difference', p_counted - v_stock);
end;
$$;

revoke execute on function public.count_stock(uuid, integer, text) from public, anon;
grant execute on function public.count_stock(uuid, integer, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Historial general: del más nuevo al más viejo, rápido
-- ---------------------------------------------------------------------
create index if not exists stock_movements_created_at_idx
  on public.stock_movements (created_at desc);
