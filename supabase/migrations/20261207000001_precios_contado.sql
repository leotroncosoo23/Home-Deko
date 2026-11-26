-- =====================================================================
-- Precio contado (1 pago) y precio de lista (cuotas)
-- ---------------------------------------------------------------------
-- El precio cargado en cada producto/variante pasa a ser el PRECIO DE
-- LISTA (no se toca ningún valor). El precio CONTADO es la lista menos el
-- "% descuento en 1 pago" de Configuración → Precios; las ofertas de cada
-- producto se aplican solo sobre el contado.
--
-- 1. store_settings: cash_discount_percent (0 por defecto = contado igual
--    que hoy), installments_enabled (apagado) e installments_max (6).
--    Públicas para leer, editables solo por admins (policies existentes).
-- 2. cash_price_at(price, final_price, pct) y cash_price(price, final_price):
--    la regla del contado. ESPEJO EXACTO de cashPrice() en src/lib/pricing.ts
--    (si cambiás una, cambiá la otra y los dos tests de monto).
--    Con 0 % devuelve final_price tal cual, sin redondear: hasta que se
--    cargue un %, la tienda cobra exactamente lo mismo que antes.
-- 3. coupon_quote(): copia exacta de 20261201000001_cupones.sql salvo los
--    precios de cada línea, que pasan a ser los de CONTADO (los cupones se
--    aplican sobre el contado; "precio de lista" de la regla del mejor
--    precio = contado sin la oferta del producto).
-- 4. create_order(): copia exacta de 20261205000002_pagos_getnet.sql salvo
--    unit_price (= contado) y unit_price_before (= contado sin oferta).
--    Hoy todo se cobra en 1 pago. PENDIENTE (Getnet): elegir 1 pago
--    (contado) o cuotas (lista) antes de crear el pago.
--
-- Compatible con el código publicado: nada se borra ni se renombra.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Configuración
-- ---------------------------------------------------------------------
alter table public.store_settings
  add column cash_discount_percent numeric(5, 2) not null default 0
    check (cash_discount_percent >= 0 and cash_discount_percent < 100),
  add column installments_enabled boolean not null default false,
  add column installments_max smallint not null default 6
    check (installments_max in (3, 6, 9, 12));

grant select (cash_discount_percent, installments_enabled, installments_max)
  on public.store_settings to anon, authenticated;
grant update (cash_discount_percent, installments_enabled, installments_max)
  on public.store_settings to authenticated;

-- ---------------------------------------------------------------------
-- 2. Regla del contado
--   pct = 0                 → final_price (sin redondear)
--   sin oferta              → round(price × (1 − pct/100), 0)
--   con oferta (final<price)→ round(sin_oferta × final_price / price, 0)
-- ---------------------------------------------------------------------
create or replace function public.cash_price_at(p_price numeric, p_final numeric, p_pct numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_price is null or p_final is null then null
    when coalesce(p_pct, 0) <= 0 then p_final
    when p_final < p_price and p_price > 0
      then round(round(p_price * (1 - p_pct / 100), 0) * p_final / p_price, 0)
    else round(p_price * (1 - p_pct / 100), 0)
  end;
$$;

create or replace function public.cash_price(p_price numeric, p_final numeric)
returns numeric
language sql
stable
set search_path = ''
as $$
  select public.cash_price_at(
    p_price, p_final,
    coalesce((select s.cash_discount_percent from public.store_settings s limit 1), 0));
$$;

grant execute on function public.cash_price_at(numeric, numeric, numeric) to anon, authenticated, service_role;
grant execute on function public.cash_price(numeric, numeric) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. coupon_quote(): precios de contado
-- ---------------------------------------------------------------------
create or replace function public.coupon_quote(p jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_code       text := upper(regexp_replace(coalesce(p ->> 'coupon_code', ''), '\s', '', 'g'));
  v_email      text := nullif(lower(trim(coalesce(p ->> 'customer_email', ''))), '');
  v_delivery   text := p ->> 'delivery_method';
  v_today      date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  c            public.coupons%rowtype;
  v_uses       integer;
  v_subtotal   numeric(12, 2);
  v_list       numeric(12, 2);   -- todo a precio de lista
  v_list_plain numeric(12, 2);   -- lista de los productos SIN descuento propio
  v_pct_disc   numeric(12, 2);   -- lo que aporta un cupón de porcentaje
  v_shipping   numeric(12, 2);
  v_discount   numeric(12, 2) := 0;
  v_total      numeric(12, 2);
begin
  select * into c from public.coupons where code = v_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_existe');
  end if;

  if not c.is_active then
    return jsonb_build_object('ok', false, 'error', 'pausado');
  end if;
  if c.starts_on is not null and c.starts_on > v_today then
    return jsonb_build_object('ok', false, 'error', 'no_empezo', 'starts_on', c.starts_on);
  end if;
  if c.ends_on is not null and c.ends_on < v_today then
    return jsonb_build_object('ok', false, 'error', 'vencido', 'ends_on', c.ends_on);
  end if;

  select count(*) into v_uses
    from public.coupon_redemptions cr
   where cr.coupon_id = c.id and cr.released_at is null;
  if c.max_uses is not null and v_uses >= c.max_uses then
    return jsonb_build_object('ok', false, 'error', 'agotado');
  end if;

  if c.one_per_customer and v_email is not null and exists (
    select 1 from public.coupon_redemptions cr
     where cr.coupon_id = c.id and cr.released_at is null and cr.customer_email = v_email
  ) then
    return jsonb_build_object('ok', false, 'error', 'ya_usado', 'email', v_email);
  end if;

  -- Productos (mismos precios que create_order: store_variants + producto activo)
  with w as (
    select (i ->> 'variant_id')::uuid as variant_id,
           sum((i ->> 'qty')::integer)::integer as qty
      from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) as i
     group by 1
  ), l as (
    -- Precio contado: price = contado sin oferta, final_price = contado (cash_price)
    select w.qty,
           public.cash_price(sv.price, sv.price) as price,
           public.cash_price(sv.price, sv.final_price) as final_price
      from w
      join public.store_variants sv on sv.variant_id = w.variant_id
      join public.products pr on pr.id = sv.product_id and pr.status = 'active'
  )
  select coalesce(sum(round(l.final_price * l.qty, 2)), 0),
         coalesce(sum(round(l.price * l.qty, 2)), 0),
         coalesce(sum(round(l.price * l.qty, 2)) filter (where l.final_price >= l.price), 0),
         coalesce(sum(greatest(0,
           round(l.final_price * l.qty, 2)
           - round(round(l.price * (1 - coalesce(c.value, 0) / 100), 2) * l.qty, 2))), 0)
    into v_subtotal, v_list, v_list_plain, v_pct_disc
    from l;

  if c.min_purchase is not null and v_subtotal < c.min_purchase then
    return jsonb_build_object('ok', false, 'error', 'minimo',
      'min_purchase', c.min_purchase, 'missing', c.min_purchase - v_subtotal);
  end if;

  select s.shipping_cost into v_shipping from public.store_settings s limit 1;
  v_shipping := case when v_delivery = 'shipping' then coalesce(v_shipping, 0) else 0 end;

  if c.kind = 'percent' then
    v_discount := v_pct_disc;
  elsif c.kind = 'fixed' then
    v_discount := greatest(
      least(c.value, v_list_plain),                     -- A
      v_subtotal - (v_list - least(c.value, v_list)),   -- B
      0);
  else  -- free_shipping
    if v_delivery is distinct from 'shipping' then
      return jsonb_build_object('ok', false, 'error', 'solo_envio');
    end if;
    v_discount := v_shipping;
  end if;

  -- El total nunca baja de $ 0 (los productos no se descuentan más que su subtotal)
  if c.kind <> 'free_shipping' then
    v_discount := least(v_discount, v_subtotal);
  end if;

  if v_discount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'sin_efecto');
  end if;

  v_total := v_subtotal - v_discount + v_shipping;
  -- Mercado Pago no cobra $ 0: un cupón que cubre todo se coordina por WhatsApp
  if v_total <= 0 then
    return jsonb_build_object('ok', false, 'error', 'total_cero');
  end if;

  return jsonb_build_object(
    'ok', true,
    'coupon_id', c.id,
    'code', c.code,
    'kind', c.kind,
    'value', c.value,
    'discount', v_discount,
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'total', v_total);
end;
$$;

revoke all on function public.coupon_quote(jsonb) from public, anon, authenticated;
grant execute on function public.coupon_quote(jsonb) to service_role;

-- ---------------------------------------------------------------------
-- 4. create_order(): cobra el precio contado
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
begin
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
         public.cash_price(sv.price, sv.final_price) as unit_price,
         case when public.cash_price(sv.price, sv.final_price) < public.cash_price(sv.price, sv.price)
              then public.cash_price(sv.price, sv.price) end as unit_price_before,
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
    customer_dni, billing_street, billing_number, billing_postal_code
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
    v_dni, v_bill_street, v_bill_number, v_bill_postal
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
