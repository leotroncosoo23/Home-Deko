-- =====================================================================
-- Test del monto: precio contado (cash_price) = carrito = create_order
-- ---------------------------------------------------------------------
-- Corre en PRODUCCIÓN dentro de una transacción que SIEMPRE se deshace
-- (rollback al final): no queda nada guardado. Efectos que NO vuelven
-- atrás: create_order consume 1 número de pedido (identity) y cada
-- variante nueva consume 1 código de barras (barcode_seq). Quedan huecos
-- en la numeración; no afectan nada.
-- No dispara nada externo (sin pg_net ni webhooks; los mails los manda la app).
--
-- MISMOS números que src/lib/pricing.test.ts ("monto de punta a punta"):
--   A: lista 10.000, oferta 20 %, 2 unidades → contado 6.800 c/u
--   B: lista 12.345,67 sin oferta, 1 unidad  → contado 10.494
--   15 % en 1 pago, retiro en el local → total 24.094
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
  -- 1. Con 0 % (como está hoy producción) el contado es el precio tal cual
  if public.cash_price_at(12345.67, 12345.67, 0) <> 12345.67 then
    raise exception 'd=0 sin oferta: %', public.cash_price_at(12345.67, 12345.67, 0);
  end if;
  if public.cash_price_at(12345.67, 11111.10, 0) <> 11111.10 then
    raise exception 'd=0 con oferta: %', public.cash_price_at(12345.67, 11111.10, 0);
  end if;

  -- 2. Casos de cashPrice() en pricing.test.ts
  if public.cash_price_at(10000, 10000, 15) <> 8500 then raise exception 'lista 10000'; end if;
  if public.cash_price_at(12345.67, 12345.67, 15) <> 10494 then raise exception 'lista 12345,67'; end if;
  if public.cash_price_at(1001, 1001, 15) <> 851 then raise exception 'mitad 850,85'; end if;
  if public.cash_price_at(10, 10, 15) <> 9 then raise exception 'mitad 8,5'; end if;
  if public.cash_price_at(10000, 8000, 15) <> 6800 then raise exception 'oferta 20 %%'; end if;
  if public.cash_price_at(50000, 45000, 15) <> 38250 then raise exception 'oferta fija'; end if;
  if public.cash_price_at(0, 0, 15) <> 0 then raise exception 'precio 0'; end if;

  -- 3. Datos de prueba (se deshacen) y 15 % en 1 pago SOLO dentro de esta transacción
  update public.store_settings set cash_discount_percent = 15;

  insert into public.products (name, slug, base_price, status, discount_type, discount_value)
  values ('prueba-contado A', 'prueba-contado-a', 10000, 'active', 'percent', 20)
  returning id into v_a;
  insert into public.products (name, slug, base_price, status)
  values ('prueba-contado B', 'prueba-contado-b', 12345.67, 'active')
  returning id into v_b;

  insert into public.product_variants (product_id, stock, is_default) values (v_a, 10, true) returning id into v_va;
  insert into public.product_variants (product_id, stock, is_default) values (v_b, 10, true) returning id into v_vb;

  if public.cash_price(10000, 8000) <> 6800 then
    raise exception 'cash_price no lee el 15 %%: %', public.cash_price(10000, 8000);
  end if;

  v_items := jsonb_build_array(
    jsonb_build_object('variant_id', v_va, 'qty', 2),
    jsonb_build_object('variant_id', v_vb, 'qty', 1));

  -- 4. Cupón 10 % sobre el contado (regla del mejor precio):
  --    A ya tiene oferta más grande → 0 ; B: 10.494 − 9.444,60 = 1.049,40
  insert into public.coupons (code, kind, value) values ('PRUEBA-CONTADO', 'percent', 10);
  v_quote := public.coupon_quote(jsonb_build_object(
    'coupon_code', 'PRUEBA-CONTADO', 'delivery_method', 'pickup', 'items', v_items));
  if not (v_quote ->> 'ok')::boolean
     or (v_quote ->> 'subtotal')::numeric <> 24094
     or (v_quote ->> 'discount')::numeric <> 1049.40
     or (v_quote ->> 'total')::numeric <> 23044.60 then
    raise exception 'coupon_quote: %', v_quote;
  end if;

  -- 5. create_order: lo que se cobra (orders.total es lo que se manda a pagar)
  select * into v_order from public.create_order(jsonb_build_object(
    'delivery_method', 'pickup',
    'customer_name', 'prueba-contado',
    'customer_email', 'prueba-contado@example.com',
    'customer_phone', '2945000000',
    'coupon_code', 'PRUEBA-CONTADO',
    'items', v_items));

  select * into v_row from public.orders where id = v_order.order_id;
  if v_row.subtotal <> 24094 or v_row.discount_total <> 1049.40 or v_row.total <> 23044.60
     or v_order.total <> v_row.total then
    raise exception 'create_order: subtotal % descuento % total %', v_row.subtotal, v_row.discount_total, v_row.total;
  end if;

  select * into v_line_a from public.order_items where order_id = v_order.order_id and variant_id = v_va;
  select * into v_line_b from public.order_items where order_id = v_order.order_id and variant_id = v_vb;
  if v_line_a.unit_price <> 6800 or v_line_a.unit_price_before <> 8500 or v_line_a.line_total <> 13600 then
    raise exception 'línea A: % / % / %', v_line_a.unit_price, v_line_a.unit_price_before, v_line_a.line_total;
  end if;
  if v_line_b.unit_price <> 10494 or v_line_b.unit_price_before is not null or v_line_b.line_total <> 10494 then
    raise exception 'línea B: % / % / %', v_line_b.unit_price, v_line_b.unit_price_before, v_line_b.line_total;
  end if;

  raise notice 'OK: carrito 24094 = create_order subtotal %, total con cupón % (pedido #% deshecho)',
    v_row.subtotal, v_row.total, v_order.order_number;
end;
$$;

rollback;
