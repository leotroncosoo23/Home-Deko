-- =====================================================================
-- Migración: Categorías — visibilidad, imagen y orden
-- ---------------------------------------------------------------------
-- 1. Columnas nuevas en categories:
--      is_visible → si la categoría se muestra en la tienda.
--      image_path → ruta de la imagen en Storage (bucket product-images,
--                   carpeta categories/). Se guarda la RUTA y no la URL,
--                   así sigue sirviendo si cambia el dominio.
-- 2. La tienda solo puede leer las categorías visibles.
-- 3. No se puede borrar una categoría que tenga productos (on delete
--    restrict): lo garantiza la base, no solo la pantalla.
-- 4. Función reorder_categories(): guarda el orden nuevo de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------
alter table public.categories
  add column is_visible boolean not null default true,
  add column image_path text check (image_path is null or length(trim(image_path)) > 0);

-- Para ordenar rápido el listado (panel y tienda).
create index categories_sort_order_idx on public.categories (sort_order);

-- ---------------------------------------------------------------------
-- 2. Lectura: la tienda ve solo las visibles; los admins ven todas.
--    (Los grants no cambian: anon/authenticated ya tenían select.)
-- ---------------------------------------------------------------------
drop policy "Todos: ver categorías" on public.categories;

create policy "Tienda: ver categorías visibles; admins: todas"
  on public.categories for select
  to anon, authenticated
  using (is_visible or (select public.is_admin()));

-- ---------------------------------------------------------------------
-- 3. Producto → categoría: antes "on delete set null" (el producto
--    quedaba sin categoría sin avisar). Ahora "restrict": si la categoría
--    tiene productos (de cualquier estado), la base rechaza el borrado.
--    La solución para esos casos es ocultarla (is_visible = false).
-- ---------------------------------------------------------------------
alter table public.products
  drop constraint products_category_id_fkey;

alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id) references public.categories (id)
  on delete restrict;

-- ---------------------------------------------------------------------
-- 4. reorder_categories(ids): recibe los ids en el orden nuevo y pone
--    sort_order = 1, 2, 3… en UNA sola sentencia. Si algo falla, no se
--    guarda nada (nunca queda un orden a medias).
--
--    security invoker (el default): corre con los permisos de quien la
--    llama, así que además de la verificación de abajo aplica el RLS.
-- ---------------------------------------------------------------------
create or replace function public.reorder_categories(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para ordenar categorías'
      using errcode = '42501';
  end if;

  if p_ids is null or cardinality(p_ids) = 0 then
    return;
  end if;

  -- El mismo id dos veces sería un error de la app: mejor frenarlo.
  if cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) as x) then
    raise exception 'La lista de categorías tiene ids repetidos'
      using errcode = '22023';
  end if;

  -- "with ordinality" numera cada elemento según su posición (1, 2, 3…).
  update public.categories c
     set sort_order = o.pos
    from unnest(p_ids) with ordinality as o(id, pos)
   where c.id = o.id
     and c.sort_order is distinct from o.pos;  -- no tocar las que no cambian
end;
$$;

revoke execute on function public.reorder_categories(uuid[]) from public, anon;
grant execute on function public.reorder_categories(uuid[]) to authenticated, service_role;
