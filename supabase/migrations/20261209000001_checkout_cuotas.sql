-- =====================================================================
-- Checkout: 1 pago (precio contado) o cuotas sin interés (precio de lista)
-- ---------------------------------------------------------------------
-- 1. orders.payment_plan ('single' | 'installments', default 'single') y
--    orders.installments (3/6/9/12; null en 1 pago). Los pedidos de antes
--    quedan como 'single' (todos fueron en 1 pago).
-- 2. create_order(): copia exacta de 20261208000001_precios_recargo.sql
--    salvo la forma de pago. Recibe payment_plan e installments, valida
--    contra Configuración (cuotas prendidas, N en 3/6/9/12 y <= máximo; los
--    cupones son solo para 1 pago) y calcula en la base:
--      1 pago → final_price (precio cargado con la oferta)
--      cuotas → round(price × (1 + list_surcharge_percent / 100), 2)
--    El envío se suma igual en los dos (sin recargo). Nunca usa montos del
--    navegador. Sin payment_plan → 1 pago: el código publicado sigue igual.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Pedidos
-- ---------------------------------------------------------------------
alter table public.orders
  add column payment_plan text not null default 'single'
    check (payment_plan in ('single', 'installments')),
  add column installments smallint
    check (installments in (3, 6, 9, 12)),
  add constraint orders_payment_plan_installments_check check (
    (payment_plan = 'single' and installments is null)
    or (payment_plan = 'installments' and installments is not null)
  );

-- El panel lee los pedidos con la sesión del admin (permisos por columna).
grant select (payment_plan, installments) on public.orders to authenticated;

-- ---------------------------------------------------------------------
-- 2. create_order(): forma de pago
-- ---------------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns table (order_id uuid, order_number bigint, total numeric)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_delivery     public.delivery_method := (p ->> 'delivery_method')::public.delivery_method;
  v_shipping     numeric(12, 2);
  v_address      text;
  v_hours        text;
  v_subtotal     numeric(12, 2);
  v_order_id     uuid := coalesce(nullif(p ->> 'id', '')::uuid, gen_random_uuid());
  v_number       bigint;
  v_total        numeric(12, 2);
  v_bad          text;
  v_quote        jsonb;
  v_discount     numeric(12, 2) := 0;
  v_coupon_id    uuid;
  v_coupon_code  text;
  v_provider     text := coalesce(nullif(p ->> 'payment_provider', ''), 'mercadopago');
  v_dni          text := nullif(trim(coalesce(p ->> 'customer_dni', '')), '');
  v_bill_street  text := nullif(trim(coalesce(p ->> 'billing_street', '')), '');
  v_bill_number  text := nullif(trim(coalesce(p ->> 'billing_number', '')), '');
  v_bill_postal  text := upper(nullif(trim(coalesce(p ->> 'billing_postal_code', '')), ''));
  -- Forma de pago: 'single' (1 pago, precio contado) o 'installments' (cuotas, precio de lista)
  v_plan         text := coalesce(nullif(p ->> 'payment_plan', ''), 'single');
  v_installments integer;
  v_inst_on      boolean;
  v_inst_max     smallint;
  v_surcharge    numeric(5, 2);
begin
  if v_plan not in ('single', 'installments') then
    raise exception 'plan_invalido';
  end if;
  if v_plan = 'installments' then
    -- La configuración manda: cuotas prendidas y N permitido (3/6/9/12, hasta el máximo).
    select s.installments_enabled, s.installments_max, s.list_surcharge_percent
      into v_inst_on, v_inst_max, v_surcharge
      from public.store_settings s
     limit 1;
    if not coalesce(v_inst_on, false) then
      raise exception 'cuotas_no_disponibles';
    end if;
    if coalesce(p ->> 'installments', '') !~ '^[0-9]{1,2}$' then
      raise exception 'cuotas_invalidas';
    end if;
    v_installments := (p ->> 'installments')::integer;
    if v_installments not in (3, 6, 9, 12) or v_installments > v_inst_max then
      raise exception 'cuotas_invalidas';
    end if;
    -- Los cupones son solo para 1 pago.
    if nullif(trim(coalesce(p ->> 'coupon_code', '')), '') is not null then
      raise exception 'cupon_solo_1_pago';
    end if;
  end if;

  if v_provider not in ('mercadopago', 'getnet') then
    raise exception 'proveedor_invalido';
  end if;
  if v_provider = 'getnet'
     and (v_dni is null or v_bill_street is null or v_bill_number is null or v_bill_postal is null) then
    raise exception 'datos_pago';
  end if;

  drop table if exists pg_temp._wanted;
  drop table if exists pg_temp._lines;

  create temporary table _wanted on commit drop as
  select (i ->> 'variant_id')::uuid as variant_id,
         sum((i ->> 'qty')::integer)::integer as qty
    from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) as i
   group by 1;

  if not exists (select 1 from pg_temp._wanted) then
    raise exception 'carrito_vacio';
  end if;
  if (select count(*) from pg_temp._wanted) > 50
     or exists (select 1 from pg_temp._wanted where qty < 1 or qty > 99) then
    raise exception 'carrito_invalido';
  end if;

  create temporary table _lines on commit drop as
  select w.variant_id,
         w.qty,
         sv.product_id,
         pr.name as product_name,
         -- 1 pago: precio cargado con la oferta. Cuotas: precio de lista =
         -- precio cargado SIN oferta × (1 + recargo), a centavos (= listPrice() en src/lib/pricing.ts).
         case when v_plan = 'installments'
              then round(sv.price * (1 + v_surcharge / 100), 2)
              else sv.final_price end as unit_price,
         case when v_plan = 'single' and sv.final_price < sv.price then sv.price end as unit_price_before,
         sv.stock,
         sp.primary_image_path as image_path,
         (select string_agg(pov.value, ' / ' order by po.position, pov.position)
            from public.variant_option_values vov
            join public.product_option_values pov on pov.id = vov.option_value_id
            join public.product_options po on po.id = pov.option_id
           where vov.variant_id = w.variant_id) as variant_label
    from pg_temp._wanted w
    left join public.store_variants sv on sv.variant_id = w.variant_id
    left join public.products pr on pr.id = sv.product_id and pr.status = 'active'
    left join public.store_products sp on sp.id = sv.product_id;

  select string_agg(variant_id::text, ',') into v_bad
    from pg_temp._lines where product_name is null or unit_price is null;
  if v_bad is not null then
    raise exception 'no_disponible' using detail = v_bad;
  end if;

  select string_agg(variant_id::text, ',') into v_bad
    from pg_temp._lines where stock < qty;
  if v_bad is not null then
    raise exception 'sin_stock' using detail = v_bad;
  end if;

  select s.shipping_cost, s.store_address, s.store_hours
    into v_shipping, v_address, v_hours
    from public.store_settings s
   limit 1;

  if v_delivery = 'pickup' then
    v_shipping := 0;
  end if;

  select sum(round(unit_price * qty, 2)) into v_subtotal from pg_temp._lines;

  -- Cupón (paso 7): misma cuenta que la vista previa del checkout
  if nullif(trim(coalesce(p ->> 'coupon_code', '')), '') is not null then
    v_quote := public.coupon_quote(p);
    if not coalesce((v_quote ->> 'ok')::boolean, false) then
      raise exception 'cupon' using detail = v_quote::text;
    end if;
    v_discount    := (v_quote ->> 'discount')::numeric;
    v_coupon_id   := (v_quote ->> 'coupon_id')::uuid;
    v_coupon_code := v_quote ->> 'code';
  end if;

  v_total := v_subtotal - v_discount + v_shipping;

  insert into public.orders (
    id, access_token_hash, delivery_method, created_by, customer_id,
    customer_name, customer_email, customer_phone,
    ship_address, ship_apartment, ship_city, ship_province, ship_postal_code, ship_notes,
    pickup_address, pickup_hours,
    subtotal, shipping_cost, discount_total, coupon_id, coupon_code, total,
    payment_provider, payment_method,
    customer_dni, billing_street, billing_number, billing_postal_code,
    payment_plan, installments
  ) values (
    v_order_id,
    p ->> 'access_token_hash',
    v_delivery,
    nullif(p ->> 'created_by', '')::uuid,
    -- Dueño del pedido (Mis pedidos): el servidor lo llena con el id de la
    -- SESIÓN, nunca con algo que mande el formulario. Sin sesión → vacío.
    nullif(p ->> 'customer_id', '')::uuid,
    trim(p ->> 'customer_name'),
    lower(trim(p ->> 'customer_email')),
    p ->> 'customer_phone',
    case when v_delivery = 'shipping' then trim(p ->> 'ship_address') end,
    case when v_delivery = 'shipping' then nullif(trim(p ->> 'ship_apartment'), '') end,
    case when v_delivery = 'shipping' then trim(p ->> 'ship_city') end,
    case when v_delivery = 'shipping' then p ->> 'ship_province' end,
    case when v_delivery = 'shipping' then upper(trim(p ->> 'ship_postal_code')) end,
    case when v_delivery = 'shipping' then nullif(trim(p ->> 'ship_notes'), '') end,
    case when v_delivery = 'pickup' then v_address end,
    case when v_delivery = 'pickup' then v_hours end,
    v_subtotal, v_shipping, v_discount, v_coupon_id, v_coupon_code, v_total,
    v_provider,
    v_provider::public.payment_method,
    v_dni, v_bill_street, v_bill_number, v_bill_postal,
    v_plan, v_installments
  )
  returning orders.order_number into v_number;

  insert into public.order_items (
    order_id, variant_id, product_id, product_name, variant_label, image_path,
    unit_price, unit_price_before, quantity, line_total
  )
  select v_order_id, l.variant_id, l.product_id, l.product_name, l.variant_label, l.image_path,
         l.unit_price, l.unit_price_before, l.qty, round(l.unit_price * l.qty, 2)
    from pg_temp._lines l
   order by l.product_name, l.variant_label;

  perform public.log_order_event(v_order_id, 'created', null, 'awaiting_payment',
    case when v_coupon_code is not null
         then 'Cupón ' || v_coupon_code || ': −' || public.format_ars(v_discount) end);

  return query select v_order_id, v_number, v_total;
end;
$$;

revoke all on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;
