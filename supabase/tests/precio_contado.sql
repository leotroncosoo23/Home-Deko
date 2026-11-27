-- =====================================================================
-- Test del monto: lo que se cobra = precio cargado (contado) = carrito
-- ---------------------------------------------------------------------
-- Corre en PRODUCCIÓN dentro de una transacción que SIEMPRE se deshace
-- (rollback al final): no queda nada guardado. Efectos que NO vuelven
-- atrás: create_order consume 1 número de pedido (identity) y cada
-- variante nueva consume 1 código de barras (barcode_seq). Quedan huecos
-- en la numeración; no afectan nada.
-- No dispara nada externo (sin pg_net ni webhooks; los mails los manda la app).
--
-- MISMOS números que src/lib/pricing.test.ts ("monto de punta a punta"):
--   A: 38.000 sin oferta, 1 unidad          → 38.000 (lista 47.120)
--   B: 10.000 con oferta 20 %, 2 unidades   → 8.000 c/u (lista 12.400)
--   24 % de recargo para la lista, retiro en el local → total 54.000
-- El recargo NO cambia lo que se cobra (solo lo que se muestra como lista).
--
-- Si algo no coincide, falla con raise exception (y también se deshace).
-- =====================================================================
begin;

do $$
declare
  v_a        uuid;
  v_b        uuid;
  v_va       uuid;
  v_vb       uuid;
  v_items    jsonb;
  v_quote    jsonb;
  v_order    record;
  v_row      public.orders%rowtype;
  v_line_a   public.order_items%rowtype;
  v_line_b   public.order_items%rowtype;
begin
  -- 1. Recargo: 0 a 999,99 (check < 1000)
  begin
    update public.store_settings set list_surcharge_percent = 1000;
    raise exception 'el check dejó guardar 1000 %%';
  exception when check_violation or numeric_value_out_of_range then
    null;  -- bien: no se puede
  end;

  -- 2. Datos de prueba (se deshacen) y 24 % de recargo SOLO dentro de esta transacción
  update public.store_settings set list_surcharge_percent = 24;

  insert into public.products (name, slug, base_price, status)
  values ('prueba-contado A', 'prueba-contado-a', 38000, 'active')
  returning id into v_a;
  insert into public.products (name, slug, base_price, status, discount_type, discount_value)
  values ('prueba-contado B', 'prueba-contado-b', 10000, 'active', 'percent', 20)
  returning id into v_b;

  insert into public.product_variants (product_id, stock, is_default) values (v_a, 10, true) returning id into v_va;
  insert into public.product_variants (product_id, stock, is_default) values (v_b, 10, true) returning id into v_vb;

  v_items := jsonb_build_array(
    jsonb_build_object('variant_id', v_va, 'qty', 1),
    jsonb_build_object('variant_id', v_vb, 'qty', 2));

  -- 3. Cupón 10 % sobre el precio cargado (regla del mejor precio):
  --    A: 38.000 − 34.200 = 3.800 ; B ya tiene una oferta más grande → 0
  insert into public.coupons (code, kind, value) values ('PRUEBA-CONTADO', 'percent', 10);
  v_quote := public.coupon_quote(jsonb_build_object(
    'coupon_code', 'PRUEBA-CONTADO', 'delivery_method', 'pickup', 'items', v_items));
  if not (v_quote ->> 'ok')::boolean
     or (v_quote ->> 'subtotal')::numeric <> 54000
     or (v_quote ->> 'discount')::numeric <> 3800
     or (v_quote ->> 'total')::numeric <> 50200 then
    raise exception 'coupon_quote: %', v_quote;
  end if;

  -- 4. create_order: lo que se cobra (orders.total es lo que se manda a pagar)
  select * into v_order from public.create_order(jsonb_build_object(
    'delivery_method', 'pickup',
    'customer_name', 'prueba-contado',
    'customer_email', 'prueba-contado@example.com',
    'customer_phone', '2945000000',
    'coupon_code', 'PRUEBA-CONTADO',
    'items', v_items));

  select * into v_row from public.orders where id = v_order.order_id;
  if v_row.subtotal <> 54000 or v_row.discount_total <> 3800 or v_row.total <> 50200
     or v_order.total <> v_row.total then
    raise exception 'create_order: subtotal % descuento % total %', v_row.subtotal, v_row.discount_total, v_row.total;
  end if;

  select * into v_line_a from public.order_items where order_id = v_order.order_id and variant_id = v_va;
  select * into v_line_b from public.order_items where order_id = v_order.order_id and variant_id = v_vb;
  if v_line_a.unit_price <> 38000 or v_line_a.unit_price_before is not null or v_line_a.line_total <> 38000 then
    raise exception 'línea A: % / % / %', v_line_a.unit_price, v_line_a.unit_price_before, v_line_a.line_total;
  end if;
  if v_line_b.unit_price <> 8000 or v_line_b.unit_price_before <> 10000 or v_line_b.line_total <> 16000 then
    raise exception 'línea B: % / % / %', v_line_b.unit_price, v_line_b.unit_price_before, v_line_b.line_total;
  end if;

  raise notice 'OK: carrito 54000 = create_order subtotal %, total con cupón % (pedido #% deshecho)',
    v_row.subtotal, v_row.total, v_order.order_number;
end;
$$;

rollback;
