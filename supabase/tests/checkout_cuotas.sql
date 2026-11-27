-- =====================================================================
-- Test: create_order con 1 pago y con cuotas (checkout-cuotas)
-- ---------------------------------------------------------------------
-- Corre en PRODUCCIÓN dentro de una transacción que SIEMPRE se deshace
-- (rollback al final): no queda nada guardado. Efectos que NO vuelven
-- atrás: cada pedido creado consume 1 número de pedido (acá 3) y cada
-- variante nueva 1 código de barras (acá 2). Los pedidos rechazados por
-- validación fallan antes de insertar y no consumen número.
-- No dispara nada externo (sin pg_net ni webhooks; los mails los manda la app).
--
-- MISMOS números que src/lib/pricing.test.ts:
--   A: 38.000 sin oferta, 1 unidad          → 1 pago 38.000 · lista 47.120
--   B: 10.000 con oferta 20 %, 2 unidades   → 1 pago 8.000 c/u · lista 12.400 c/u
--   24 % de recargo, cuotas prendidas hasta 6
--   1 pago: 54.000 · 6 cuotas: 71.920 (11.986,67 c/u) · con envío se suma igual
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
  v_ship     numeric;
  v_base     jsonb;
  v_order    record;
  v_row      public.orders%rowtype;
  v_line     public.order_items%rowtype;
  v_err      text;
begin
  update public.store_settings
     set list_surcharge_percent = 24, installments_enabled = true, installments_max = 6;
  select s.shipping_cost into v_ship from public.store_settings s limit 1;

  insert into public.products (name, slug, base_price, status)
  values ('prueba-cuotas A', 'prueba-cuotas-a', 38000, 'active')
  returning id into v_a;
  insert into public.products (name, slug, base_price, status, discount_type, discount_value)
  values ('prueba-cuotas B', 'prueba-cuotas-b', 10000, 'active', 'percent', 20)
  returning id into v_b;
  insert into public.product_variants (product_id, stock, is_default) values (v_a, 10, true) returning id into v_va;
  insert into public.product_variants (product_id, stock, is_default) values (v_b, 10, true) returning id into v_vb;
  insert into public.coupons (code, kind, value) values ('PRUEBA-CUOTAS', 'percent', 10);

  v_base := jsonb_build_object(
    'delivery_method', 'pickup',
    'customer_name', 'prueba-cuotas',
    'customer_email', 'prueba-cuotas@example.com',
    'customer_phone', '2945000000',
    'items', jsonb_build_array(
      jsonb_build_object('variant_id', v_va, 'qty', 1),
      jsonb_build_object('variant_id', v_vb, 'qty', 2)));

  -- 1. 1 pago (sin payment_plan: como el código publicado) → 54.000
  select * into v_order from public.create_order(v_base);
  select * into v_row from public.orders where id = v_order.order_id;
  if v_row.total <> 54000 or v_row.payment_plan <> 'single' or v_row.installments is not null then
    raise exception '1 pago: total % plan % cuotas %', v_row.total, v_row.payment_plan, v_row.installments;
  end if;

  -- 2. 6 cuotas → precio de lista: 47.120 + 12.400 × 2 = 71.920
  select * into v_order from public.create_order(v_base || '{"payment_plan": "installments", "installments": 6}');
  select * into v_row from public.orders where id = v_order.order_id;
  if v_row.subtotal <> 71920 or v_row.total <> 71920
     or v_row.payment_plan <> 'installments' or v_row.installments <> 6 then
    raise exception '6 cuotas: subtotal % total % plan % cuotas %',
      v_row.subtotal, v_row.total, v_row.payment_plan, v_row.installments;
  end if;
  select * into v_line from public.order_items where order_id = v_order.order_id and variant_id = v_vb;
  if v_line.unit_price <> 12400 or v_line.unit_price_before is not null or v_line.line_total <> 24800 then
    raise exception 'cuotas, línea B: % / % / %', v_line.unit_price, v_line.unit_price_before, v_line.line_total;
  end if;

  -- 3. 3 cuotas con envío: el envío se suma sin recargo
  select * into v_order from public.create_order(v_base || jsonb_build_object(
    'payment_plan', 'installments', 'installments', 3,
    'delivery_method', 'shipping', 'ship_address', 'Mitre 123', 'ship_city', 'Trevelin',
    'ship_province', 'Chubut', 'ship_postal_code', '9203'));
  select * into v_row from public.orders where id = v_order.order_id;
  if v_row.total <> 71920 + v_ship or v_row.shipping_cost <> v_ship then
    raise exception 'cuotas con envío: total % envío %', v_row.total, v_row.shipping_cost;
  end if;

  -- 4. N no permitido: 9 > máximo (6) y 5 (no está en 3/6/9/12) → cuotas_invalidas
  begin
    perform public.create_order(v_base || '{"payment_plan": "installments", "installments": 9}');
    raise exception 'dejó pasar 9 cuotas con máximo 6';
  exception when raise_exception then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'cuotas_invalidas' then raise exception '9 cuotas: %', v_err; end if;
  end;
  begin
    perform public.create_order(v_base || '{"payment_plan": "installments", "installments": 5}');
    raise exception 'dejó pasar 5 cuotas';
  exception when raise_exception then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'cuotas_invalidas' then raise exception '5 cuotas: %', v_err; end if;
  end;

  -- 5. Cupón + cuotas → cupon_solo_1_pago
  begin
    perform public.create_order(v_base || '{"payment_plan": "installments", "installments": 6, "coupon_code": "PRUEBA-CUOTAS"}');
    raise exception 'dejó pasar cupón con cuotas';
  exception when raise_exception then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'cupon_solo_1_pago' then raise exception 'cupón con cuotas: %', v_err; end if;
  end;

  -- 6. Plan inventado → plan_invalido
  begin
    perform public.create_order(v_base || '{"payment_plan": "otro"}');
    raise exception 'dejó pasar un plan inventado';
  exception when raise_exception then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'plan_invalido' then raise exception 'plan inventado: %', v_err; end if;
  end;

  -- 7. Cuotas apagadas en Configuración → cuotas_no_disponibles
  update public.store_settings set installments_enabled = false;
  begin
    perform public.create_order(v_base || '{"payment_plan": "installments", "installments": 6}');
    raise exception 'dejó pasar cuotas apagadas';
  exception when raise_exception then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'cuotas_no_disponibles' then raise exception 'cuotas apagadas: %', v_err; end if;
  end;

  raise notice 'OK: 1 pago 54000, 6 cuotas 71920, con envío %, validaciones bien', 71920 + v_ship;
end;
$$;

rollback;
