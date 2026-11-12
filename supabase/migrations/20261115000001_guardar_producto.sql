-- =====================================================================
-- Migración: save_product() — guardar un producto COMPLETO de una vez
-- ---------------------------------------------------------------------
-- Un producto con variantes toca hasta 8 tablas (producto, costo,
-- opciones, valores, variantes, tabla puente, costos por variante,
-- imágenes) y además registra el stock inicial. Esta función recibe
-- todo el formulario en un JSON y lo guarda en UNA transacción:
-- o se guarda todo, o no se guarda nada (nunca un producto a medias).
--
-- Corre con los permisos de quien la llama (security invoker), así que
-- aplican el RLS y los grants por columna: no puede escribir stock ni
-- barcode directamente. El stock inicial pasa por adjust_stock().
--
-- Forma del JSON (lo arma la Server Action, validado con zod):
-- {
--   "id": uuid,                       -- lo genera el formulario si es nuevo
--   "is_new": bool,
--   "expected_updated_at": timestamptz | null,  -- para detectar si otra
--                                                 persona lo editó
--   "name", "slug", "description", "category_id", "base_price",
--   "status": "draft" | "active" | "archived", "is_featured",
--   "discount": null | { "type", "value", "starts_at", "ends_at" },
--   "cost_price": number | null,
--   "has_variants": bool,
--   "options":  [ { "id"?, "name", "values": [ { "key", "id"?, "value", "color_hex"? } ] } ],
--   "variants": [ { "id"?, "value_keys": [key...], "sku", "price", "cost_price",
--                   "min_stock", "initial_stock" } ],
--   "images":   [ { "storage_path", "is_primary", "color_value_key"?, "alt_text"? } ]
-- }
-- "key" es un nombre provisorio que pone el formulario a cada valor
-- (los valores nuevos todavía no tienen id) para poder referirse a él
-- desde las variantes y las imágenes.
--
-- Devuelve: { "id", "updated_at", "removed_image_paths": [...] }
-- (la Server Action borra esos archivos de Storage).
--
-- Errores con código propio (la app muestra el mensaje tal cual):
--   HD404 → el producto ya no existe
--   HD409 → otra persona lo modificó mientras tanto
--   HD422 → regla del negocio (ej.: quitar una combinación con stock)
-- =====================================================================

create or replace function public.save_product(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id            uuid    := (p ->> 'id')::uuid;
  v_is_new        boolean := coalesce((p ->> 'is_new')::boolean, false);
  v_has_variants  boolean := coalesce((p ->> 'has_variants')::boolean, false);
  v_options       jsonb   := coalesce(p -> 'options', '[]'::jsonb);
  v_variants      jsonb   := coalesce(p -> 'variants', '[]'::jsonb);
  v_images        jsonb   := coalesce(p -> 'images', '[]'::jsonb);
  v_discount      jsonb   := nullif(p -> 'discount', 'null'::jsonb);

  v_current_updated timestamptz;
  v_map           jsonb  := '{}'::jsonb;  -- clave del valor → id real
  v_opt_ids       uuid[] := '{}';         -- opciones que siguen en el formulario
  v_val_ids       uuid[] := '{}';         -- valores que siguen en el formulario
  v_option_count  integer := jsonb_array_length(coalesce(p -> 'options', '[]'::jsonb));

  v_opt record; v_val record; v_var record; v_img record;
  v_option_id  uuid;
  v_value_id   uuid;
  v_variant_id uuid;
  v_value_ids  uuid[];
  v_targets    jsonb  := '[]'::jsonb;     -- por cada variante del JSON: a qué fila va
  v_kept       uuid[] := '{}';            -- variantes existentes que se conservan
  v_target     uuid;
  v_was_active boolean;
  v_initial    integer;
  v_cost       numeric;
  v_label      text;
  v_removed_paths text[] := '{}';
  v_primary_set   boolean := false;
  v_is_primary    boolean;
  v_path          text;
  v_key           text;
begin
  -- -------------------------------------------------------------------
  -- 0. Permiso y forma general
  -- -------------------------------------------------------------------
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para guardar productos' using errcode = '42501';
  end if;

  if v_id is null then
    raise exception 'Falta el id del producto' using errcode = 'HD422';
  end if;

  if v_has_variants then
    if v_option_count < 1 or v_option_count > 3 then
      raise exception 'Un producto con variantes necesita entre 1 y 3 opciones' using errcode = 'HD422';
    end if;
    if jsonb_array_length(v_variants) < 1 or jsonb_array_length(v_variants) > 100 then
      raise exception 'Tiene que haber entre 1 y 100 combinaciones' using errcode = 'HD422';
    end if;
  else
    if v_option_count <> 0 or jsonb_array_length(v_variants) <> 1 then
      raise exception 'Un producto sin variantes tiene una sola variante y ninguna opción' using errcode = 'HD422';
    end if;
  end if;

  -- -------------------------------------------------------------------
  -- 1. El producto
  -- -------------------------------------------------------------------
  if v_is_new then
    insert into public.products (
      id, name, slug, description, category_id, base_price, status, is_featured,
      discount_type, discount_value, discount_starts_at, discount_ends_at
    ) values (
      v_id,
      p ->> 'name',
      p ->> 'slug',
      nullif(p ->> 'description', ''),
      (p ->> 'category_id')::uuid,
      (p ->> 'base_price')::numeric,
      (p ->> 'status')::public.product_status,
      coalesce((p ->> 'is_featured')::boolean, false),
      (v_discount ->> 'type')::public.discount_type,
      (v_discount ->> 'value')::numeric,
      (v_discount ->> 'starts_at')::timestamptz,
      (v_discount ->> 'ends_at')::timestamptz
    );
  else
    -- "for update" bloquea el producto hasta terminar: si dos personas
    -- guardan a la vez, la segunda espera y después ve el cambio.
    select pr.updated_at into v_current_updated
      from public.products pr
     where pr.id = v_id
       for update;

    if not found then
      raise exception 'Este producto ya no existe.' using errcode = 'HD404';
    end if;

    if p ->> 'expected_updated_at' is not null
       and v_current_updated <> (p ->> 'expected_updated_at')::timestamptz then
      raise exception 'Otra persona modificó este producto mientras lo editabas. Recargá la página para ver los cambios.'
        using errcode = 'HD409';
    end if;

    update public.products set
      name               = p ->> 'name',
      slug               = p ->> 'slug',
      description        = nullif(p ->> 'description', ''),
      category_id        = (p ->> 'category_id')::uuid,
      base_price         = (p ->> 'base_price')::numeric,
      status             = (p ->> 'status')::public.product_status,
      is_featured        = coalesce((p ->> 'is_featured')::boolean, false),
      discount_type      = (v_discount ->> 'type')::public.discount_type,
      discount_value     = (v_discount ->> 'value')::numeric,
      discount_starts_at = (v_discount ->> 'starts_at')::timestamptz,
      discount_ends_at   = (v_discount ->> 'ends_at')::timestamptz
    where id = v_id;
  end if;

  -- Costo general del producto (vacío = sin costo cargado)
  v_cost := (p ->> 'cost_price')::numeric;
  if v_cost is null then
    delete from public.product_costs where product_id = v_id;
  else
    insert into public.product_costs (product_id, cost_price) values (v_id, v_cost)
    on conflict (product_id) do update set cost_price = excluded.cost_price;
  end if;

  -- -------------------------------------------------------------------
  -- 2. Opciones y valores
  --    Con "id" → se actualiza (renombrar conserva variantes y códigos).
  --    Sin "id" → se busca por nombre (así, volver a agregar "Color" o
  --    "Rojo" reutiliza el que ya existía) o se crea.
  -- -------------------------------------------------------------------
  for v_opt in
    select o.value as o, o.ordinality as pos
      from jsonb_array_elements(v_options) with ordinality as o
  loop
    if v_opt.o ->> 'id' is not null then
      update public.product_options
         set name = v_opt.o ->> 'name', position = v_opt.pos
       where id = (v_opt.o ->> 'id')::uuid and product_id = v_id
      returning id into v_option_id;
      if v_option_id is null then
        raise exception 'Una de las opciones no pertenece a este producto' using errcode = 'HD422';
      end if;
    else
      insert into public.product_options (product_id, name, position)
      values (v_id, v_opt.o ->> 'name', v_opt.pos)
      on conflict (product_id, name) do update set position = excluded.position
      returning id into v_option_id;
    end if;
    v_opt_ids := v_opt_ids || v_option_id;

    for v_val in
      select x.value as v, x.ordinality as pos
        from jsonb_array_elements(coalesce(v_opt.o -> 'values', '[]'::jsonb)) with ordinality as x
    loop
      v_value_id := null;
      if v_val.v ->> 'id' is not null then
        update public.product_option_values
           set value = v_val.v ->> 'value',
               color_hex = nullif(v_val.v ->> 'color_hex', ''),
               position = v_val.pos
         where id = (v_val.v ->> 'id')::uuid and option_id = v_option_id
        returning id into v_value_id;
        if v_value_id is null then
          raise exception 'Uno de los valores no pertenece a esta opción' using errcode = 'HD422';
        end if;
      else
        insert into public.product_option_values (option_id, value, color_hex, position)
        values (v_option_id, v_val.v ->> 'value', nullif(v_val.v ->> 'color_hex', ''), v_val.pos)
        on conflict (option_id, value) do update
          set color_hex = excluded.color_hex, position = excluded.position
        returning id into v_value_id;
      end if;
      v_val_ids := v_val_ids || v_value_id;
      v_map := v_map || jsonb_build_object(v_val.v ->> 'key', v_value_id);
    end loop;
  end loop;

  -- -------------------------------------------------------------------
  -- 3a. Variantes: decidir a qué fila va cada una (sin escribir todavía)
  --     - con "id": esa variante
  --     - sin "id": una existente con la MISMA combinación de valores
  --       (puede estar desactivada: así recupera su código de barras)
  --     - si no hay: se crea
  -- -------------------------------------------------------------------
  for v_var in
    select x.value as v, x.ordinality as pos
      from jsonb_array_elements(v_variants) with ordinality as x
  loop
    -- Traducir las claves de los valores a ids reales
    select coalesce(array_agg((v_map ->> k)::uuid order by (v_map ->> k)::uuid), '{}')
      into v_value_ids
      from jsonb_array_elements_text(coalesce(v_var.v -> 'value_keys', '[]'::jsonb)) as k;

    if array_position(v_value_ids, null) is not null then
      raise exception 'Una combinación usa un valor que no existe' using errcode = 'HD422';
    end if;

    -- Cada combinación tiene exactamente un valor de cada opción
    if cardinality(v_value_ids) <> v_option_count
       or (select count(distinct pov.option_id)
             from public.product_option_values pov
            where pov.id = any(v_value_ids)) <> v_option_count then
      raise exception 'Cada combinación tiene que tener un valor de cada opción' using errcode = 'HD422';
    end if;

    v_target := null;
    if v_var.v ->> 'id' is not null then
      select pv.id into v_target
        from public.product_variants pv
       where pv.id = (v_var.v ->> 'id')::uuid and pv.product_id = v_id;
      if v_target is null then
        raise exception 'Una de las combinaciones no pertenece a este producto' using errcode = 'HD422';
      end if;
    else
      select pv.id into v_target
        from public.product_variants pv
       where pv.product_id = v_id
         and not (pv.id = any(v_kept))
         and coalesce((select array_agg(vov.option_value_id order by vov.option_value_id)
                         from public.variant_option_values vov
                        where vov.variant_id = pv.id), '{}') = v_value_ids
       order by pv.is_active desc  -- si hay varias, preferir la activa
       limit 1;
    end if;

    if v_target is not null then
      if v_target = any(v_kept) then
        raise exception 'Hay dos combinaciones iguales' using errcode = 'HD422';
      end if;
      v_kept := v_kept || v_target;
    end if;

    v_targets := v_targets || jsonb_build_array(jsonb_build_object(
      'target', v_target, 'values', to_jsonb(v_value_ids), 'v', v_var.v, 'pos', v_var.pos));
  end loop;

  -- -------------------------------------------------------------------
  -- 3b. Variantes que ya no están en el formulario:
  --     con stock      → NO se puede (primero ajustar el stock a 0)
  --     con historial  → se desactiva (se conserva el historial)
  --     sin historial  → se borra
  -- -------------------------------------------------------------------
  for v_var in
    select pv.id, pv.stock
      from public.product_variants pv
     where pv.product_id = v_id and pv.is_active and not (pv.id = any(v_kept))
  loop
    if v_var.stock > 0 then
      select string_agg(pov.value, ' / ' order by po.position)
        into v_label
        from public.variant_option_values vov
        join public.product_option_values pov on pov.id = vov.option_value_id
        join public.product_options po on po.id = pov.option_id
       where vov.variant_id = v_var.id;
      raise exception 'No se puede quitar «%»: tiene % en stock. Primero ajustá el stock a 0.',
        coalesce(v_label, 'la variante actual'), v_var.stock
        using errcode = 'HD422';
    end if;

    if exists (select 1 from public.stock_movements sm where sm.variant_id = v_var.id) then
      -- Se libera el SKU para que otra variante pueda usarlo.
      update public.product_variants
         set is_active = false, is_default = false, sku = null
       where id = v_var.id;
    else
      delete from public.product_variants where id = v_var.id;
    end if;
  end loop;

  -- Antes de escribir: liberar SKUs y "por defecto" de las que se
  -- conservan (evita choques si dos variantes intercambian su SKU).
  update public.product_variants
     set sku = null
   where id = any(v_kept);
  update public.product_variants
     set is_default = false
   where product_id = v_id and is_default and not (id = any(v_kept));

  -- -------------------------------------------------------------------
  -- 3c. Escribir las variantes
  -- -------------------------------------------------------------------
  for v_var in
    select t.value as t from jsonb_array_elements(v_targets) as t
  loop
    v_target  := (v_var.t ->> 'target')::uuid;
    v_initial := coalesce((v_var.t -> 'v' ->> 'initial_stock')::integer, 0);
    select coalesce(array_agg(x::uuid), '{}') into v_value_ids
      from jsonb_array_elements_text(v_var.t -> 'values') as x;

    if v_initial < 0 then
      raise exception 'El stock inicial no puede ser negativo' using errcode = 'HD422';
    end if;

    if v_target is null then
      insert into public.product_variants (product_id, sku, price, min_stock, is_default, is_active, position)
      values (
        v_id,
        nullif(trim(v_var.t -> 'v' ->> 'sku'), ''),
        (v_var.t -> 'v' ->> 'price')::numeric,
        coalesce((v_var.t -> 'v' ->> 'min_stock')::integer, 0),
        not v_has_variants,
        true,
        (v_var.t ->> 'pos')::integer
      )
      returning id into v_variant_id;
      v_was_active := false;
    else
      v_variant_id := v_target;
      select pv.is_active into v_was_active from public.product_variants pv where pv.id = v_variant_id;
      update public.product_variants set
        sku        = nullif(trim(v_var.t -> 'v' ->> 'sku'), ''),
        price      = (v_var.t -> 'v' ->> 'price')::numeric,
        min_stock  = coalesce((v_var.t -> 'v' ->> 'min_stock')::integer, 0),
        is_default = not v_has_variants,
        is_active  = true,
        position   = (v_var.t ->> 'pos')::integer
      where id = v_variant_id;
    end if;

    -- Vínculos variante ↔ valores (quitar los que sobran, agregar los que faltan)
    delete from public.variant_option_values
     where variant_id = v_variant_id and not (option_value_id = any(v_value_ids));
    insert into public.variant_option_values (variant_id, option_value_id)
    select v_variant_id, x from unnest(v_value_ids) as x
    on conflict do nothing;

    -- Costo propio de la variante (vacío = usa el del producto)
    v_cost := (v_var.t -> 'v' ->> 'cost_price')::numeric;
    if v_cost is null then
      delete from public.variant_costs where variant_id = v_variant_id;
    else
      insert into public.variant_costs (variant_id, cost_price) values (v_variant_id, v_cost)
      on conflict (variant_id) do update set cost_price = excluded.cost_price;
    end if;

    -- Stock inicial: solo en variantes nuevas o reactivadas. El stock de
    -- las que ya estaban activas se cambia con "Ajustar stock".
    if v_initial > 0 and not v_was_active then
      perform public.adjust_stock(v_variant_id, v_initial, 'inicial'::public.stock_reason, 'Stock inicial');
    end if;
  end loop;

  -- -------------------------------------------------------------------
  -- 4. Limpiar opciones y valores que ya no se usan
  --    (los que usa una variante desactivada se conservan, por el historial)
  -- -------------------------------------------------------------------
  delete from public.product_option_values pov
   using public.product_options po
   where pov.option_id = po.id
     and po.product_id = v_id
     and not (pov.id = any(v_val_ids))
     and not exists (select 1 from public.variant_option_values vov where vov.option_value_id = pov.id);

  delete from public.product_options po
   where po.product_id = v_id
     and not (po.id = any(v_opt_ids))
     and not exists (select 1 from public.product_option_values pov where pov.option_id = po.id);

  -- -------------------------------------------------------------------
  -- 5. Imágenes (en el orden del formulario)
  -- -------------------------------------------------------------------
  with gone as (
    delete from public.product_images pi
     where pi.product_id = v_id
       and pi.storage_path not in (
         select x ->> 'storage_path' from jsonb_array_elements(v_images) as x)
    returning pi.storage_path
  )
  select coalesce(array_agg(storage_path), '{}') into v_removed_paths from gone;

  update public.product_images set is_primary = false where product_id = v_id and is_primary;

  for v_img in
    select x.value as i, x.ordinality as pos
      from jsonb_array_elements(v_images) with ordinality as x
  loop
    v_path := v_img.i ->> 'storage_path';
    -- Solo archivos de la carpeta de ESTE producto
    if v_path is null or not starts_with(v_path, v_id::text || '/') then
      raise exception 'Imagen inválida' using errcode = 'HD422';
    end if;

    v_key := v_img.i ->> 'color_value_key';
    v_value_id := case when v_key is null then null else (v_map ->> v_key)::uuid end;
    if v_key is not null and v_value_id is null then
      raise exception 'Una imagen está asociada a un color que no existe' using errcode = 'HD422';
    end if;

    -- Como máximo una principal: la primera que venga marcada
    v_is_primary := coalesce((v_img.i ->> 'is_primary')::boolean, false) and not v_primary_set;
    if v_is_primary then v_primary_set := true; end if;

    insert into public.product_images (product_id, storage_path, alt_text, position, is_primary, option_value_id)
    values (v_id, v_path, nullif(v_img.i ->> 'alt_text', ''), v_img.pos, v_is_primary, v_value_id)
    on conflict (storage_path) do update set
      alt_text        = excluded.alt_text,
      position        = excluded.position,
      is_primary      = excluded.is_primary,
      option_value_id = excluded.option_value_id
    where public.product_images.product_id = v_id;
  end loop;

  -- Si ninguna vino marcada como principal, la primera lo es.
  if not v_primary_set then
    update public.product_images
       set is_primary = true
     where id = (select pi.id from public.product_images pi
                  where pi.product_id = v_id order by pi.position limit 1);
  end if;

  return jsonb_build_object(
    'id', v_id,
    'updated_at', (select pr.updated_at from public.products pr where pr.id = v_id),
    'removed_image_paths', to_jsonb(v_removed_paths)
  );
end;
$$;

revoke execute on function public.save_product(jsonb) from public, anon;
grant execute on function public.save_product(jsonb) to authenticated, service_role;
