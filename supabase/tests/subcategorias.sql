-- =====================================================================
-- Test: subcategorías (un solo nivel) y la vista store_products
-- ---------------------------------------------------------------------
-- Corre en PRODUCCIÓN dentro de una transacción que SIEMPRE se deshace
-- (rollback al final): no queda nada guardado. No crea pedidos (no
-- consume números de pedido); cada variante nueva consume 1 código de
-- barras (acá 2). No dispara nada externo.
--
-- Si algo no coincide, falla con raise exception (y también se deshace).
-- =====================================================================
begin;

do $$
declare
  v_main   uuid;
  v_main2  uuid;
  v_sub    uuid;
  v_p1     uuid;
  v_p2     uuid;
  v_err    text;
  v_n      integer;
begin
  insert into public.categories (name, slug, sort_order) values ('prueba-sub Cocina', 'prueba-sub-cocina', 900) returning id into v_main;
  insert into public.categories (name, slug, sort_order) values ('prueba-sub Baño', 'prueba-sub-bano', 901) returning id into v_main2;
  insert into public.categories (name, slug, parent_id, sort_order)
  values ('prueba-sub Utensilios', 'prueba-sub-utensilios', v_main, 1) returning id into v_sub;

  -- 1. Una subcategoría no puede tener hijas
  begin
    insert into public.categories (name, slug, parent_id) values ('prueba-sub Nieta', 'prueba-sub-nieta', v_sub);
    raise exception 'dejó crear una subcategoría dentro de otra';
  exception when check_violation then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'subcategoria_anidada' then raise exception 'nieta: %', v_err; end if;
  end;

  -- 2. Una principal con subcategorías no puede pasar a ser subcategoría
  begin
    update public.categories set parent_id = v_main2 where id = v_main;
    raise exception 'dejó convertir en subcategoría a una principal con hijas';
  exception when check_violation then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'categoria_con_hijas' then raise exception 'principal con hijas: %', v_err; end if;
  end;

  -- 3. No puede ser su propia principal
  begin
    update public.categories set parent_id = v_main2 where id = v_main2;
    raise exception 'dejó que una categoría sea su propia principal';
  exception when check_violation then
    null;
  end;

  -- 4. Mover una subcategoría a otra principal sí se puede
  update public.categories set parent_id = v_main2 where id = v_sub;
  update public.categories set parent_id = v_main where id = v_sub;

  -- 5. La principal incluye los productos de sus subcategorías
  insert into public.products (name, slug, base_price, status, category_id)
  values ('prueba-sub producto principal', 'prueba-sub-p1', 1000, 'active', v_main) returning id into v_p1;
  insert into public.products (name, slug, base_price, status, category_id)
  values ('prueba-sub producto sub', 'prueba-sub-p2', 1000, 'active', v_sub) returning id into v_p2;
  insert into public.product_variants (product_id, stock, is_default) values (v_p1, 1, true);
  insert into public.product_variants (product_id, stock, is_default) values (v_p2, 1, true);

  select count(*) into v_n from public.store_products sp
   join public.categories c on c.id = sp.category_id
   where coalesce(c.parent_id, c.id) = v_main;
  if v_n <> 2 then raise exception 'la principal muestra % productos (esperaba 2)', v_n; end if;

  -- 6. El buscador encuentra el producto de la subcategoría por el nombre de la principal
  select count(*) into v_n from public.store_products where id = v_p2 and search_text like '%prueba-sub cocina%';
  if v_n <> 1 then raise exception 'search_text no tiene el nombre de la principal'; end if;

  -- 7. Principal oculta → los productos de su subcategoría tampoco se ven
  update public.categories set is_visible = false where id = v_main;
  select count(*) into v_n from public.store_products where id in (v_p1, v_p2);
  if v_n <> 0 then raise exception 'con la principal oculta se ven % productos', v_n; end if;

  -- 8. Borrar una principal con subcategorías: la base lo frena (on delete restrict)
  update public.products set category_id = null where id in (v_p1, v_p2);
  begin
    delete from public.categories where id = v_main;
    raise exception 'dejó borrar una principal con subcategorías';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

rollback;
