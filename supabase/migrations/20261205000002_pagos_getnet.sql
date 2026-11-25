-- =====================================================================
-- Pagos con Getnet (Web Checkout) — Mercado Pago queda apagado, no se borra
--
-- 1. orders: columnas genéricas de pago (cualquier proveedor), DNI y
--    dirección de facturación (Getnet las exige). Todas nullable o con
--    default: los pedidos existentes NO se modifican (no hay backfill; el
--    código lee payment_id ?? mp_payment_id).
-- 2. create_order(): + payment_provider, DNI y facturación.
-- 3. apply_order_payment(): + p_provider y p_mismatch. Un "rechazado" no es
--    final: si después llega "aprobado" para el mismo pedido, se aprueba.
-- 4. resolve_review(): "confirmar pago" mira el estado de cualquier proveedor.
-- 5. forget_order_personal_data(): borra DNI y facturación al eliminar la cuenta.
-- 6. admin_home_attention(): + getnet_pending ("Revisar pago en Getnet").
-- =====================================================================

-- El valor 'getnet' del enum payment_method se agrega ANTES, en
-- 20261205000001_medio_pago_getnet.sql (ver ahí por qué va aparte).

-- ---------------------------------------------------------------------
-- 1. orders: columnas nuevas
-- ---------------------------------------------------------------------
alter table public.orders
  -- Con qué proveedor se inició el pago (los pedidos de antes: Mercado Pago)
  add column payment_provider      text not null default 'mercadopago',
  -- Getnet: id del payment intent, su página segura y cuándo vence
  add column payment_intent_id     text,
  add column payment_redirect_url  text,
  add column payment_expires_at    timestamptz,
  -- Genéricas (cualquier proveedor). Mercado Pago sigue llenando además mp_*.
  add column payment_id            text,
  add column provider_status       text,          -- estado normalizado del proveedor
  add column payment_status_detail text,          -- estado/mensaje tal como lo informa
  add column payment_notified_at   timestamptz,   -- último aviso (webhook) recibido
  -- Datos del cliente para el pago (Getnet). Datos personales: sin grant a
  -- authenticated; se borran al eliminar la cuenta (forget_order_personal_data).
  add column customer_dni          text,
  add column billing_street        text,
  add column billing_number        text,
  add column billing_postal_code   text;

alter table public.orders
  add constraint orders_payment_provider_ok
    check (payment_provider in ('mercadopago', 'getnet')),
  add constraint orders_customer_dni_ok
    check (customer_dni ~ '^[0-9]{7,8}$'),
  add constraint orders_billing_street_ok
    check (char_length(trim(billing_street)) between 1 and 200),
  add constraint orders_billing_number_ok
    check (char_length(trim(billing_number)) between 1 and 20),
  add constraint orders_billing_postal_code_ok
    check (billing_postal_code ~ '^[A-Za-z]?[0-9]{4}[A-Za-z]{0,3}$'),
  add constraint orders_payment_redirect_url_ok
    check (payment_redirect_url like 'https://%');

-- Un intent = un pedido (el webhook busca por acá)
create unique index orders_payment_intent_id_key
  on public.orders (payment_intent_id) where payment_intent_id is not null;

-- "Revisar pago en Getnet" (inicio del panel)
create index orders_getnet_unnotified_idx
  on public.orders (created_at)
  where payment_provider = 'getnet' and payment_intent_id is not null and payment_notified_at is null;

-- Lectura para usuarios logueados (las policies filtran qué filas).
-- EXCLUYE customer_dni, billing_* y payment_redirect_url: el panel y la
-- página del pedido los leen en el servidor, con la clave secreta.
grant select (
  payment_provider, payment_intent_id, payment_id, provider_status,
  payment_status_detail, payment_expires_at, payment_notified_at
) on public.orders to authenticated;

-- ---------------------------------------------------------------------
-- 2. create_order(): igual que en el paso 7 + proveedor, DNI y facturación
-- Copia exacta de 20261201000001_cupones.sql. Lo nuevo:
--   p ->> 'payment_provider' ('mercadopago' por defecto | 'getnet')
--   p ->> 'customer_dni', 'billing_street', 'billing_number', 'billing_postal_code'
--   Con Getnet son obligatorios → excepción 'datos_pago'.
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
         sv.final_price as unit_price,
         case when sv.final_price < sv.price then sv.price end as unit_price_before,
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

-- ---------------------------------------------------------------------
-- 3. apply_order_payment(): cualquier proveedor
-- Basada en 20261201000001_cupones.sql. Cambia la firma (2 parámetros
-- nuevos, con default) → drop + create. El webhook de Mercado Pago la sigue
-- llamando igual (p_provider = 'mercadopago' por defecto).
--
--   p_provider  'mercadopago' | 'getnet'. Si no coincide con el del pedido,
--               un "aprobado" queda para revisar (no se aprueba).
--   p_mismatch  true = el aviso no coincide con la referencia del pedido
--               (lo detecta el webhook). Un "aprobado" queda para revisar.
--
-- Getnet manda p_status ya normalizado ('approved' | 'rejected').
-- Reintentos: "rejected" NO es final. Si después llega "approved" para el
-- mismo pedido (el cliente probó con otra tarjeta), se aprueba normal. Un
-- "rejected" que llega tarde, con el pedido ya aprobado → already_processed.
-- ---------------------------------------------------------------------
drop function public.apply_order_payment(uuid, text, text, text, numeric, text);

create function public.apply_order_payment(
  p_order_id       uuid,
  p_payment_id     text,
  p_status         text,
  p_status_detail  text,
  p_amount         numeric,
  p_currency       text,
  p_provider       text default 'mercadopago',
  p_mismatch       boolean default false
)
returns table (result text, stock_changed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order   public.orders%rowtype;
  v_new     public.payment_status;
  v_issue   boolean := false;
  v_changed boolean := false;
  v_reason  text;
  v_coupon  text;
  v_is_mp   boolean := p_provider = 'mercadopago';
  v_name    text := case p_provider when 'getnet' then 'Getnet' else 'Mercado Pago' end;
begin
  if p_provider is null or p_provider not in ('mercadopago', 'getnet') then
    raise exception 'proveedor_invalido';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return query select 'not_found'::text, false;
    return;
  end if;

  v_new := case p_status
    when 'approved'     then 'approved'
    when 'pending'      then 'pending'
    when 'in_process'   then 'pending'
    when 'authorized'   then 'pending'
    when 'in_mediation' then 'pending'
    when 'rejected'     then 'rejected'
    when 'cancelled'    then 'cancelled'
    when 'refunded'     then 'cancelled'
    when 'charged_back' then 'cancelled'
  end::public.payment_status;

  if v_new is null then
    return query select 'ignored'::text, false;
    return;
  end if;

  -- ---- El pedido YA estaba aprobado ------------------------------------
  if v_order.payment_status = 'approved' then
    if p_payment_id is distinct from coalesce(v_order.payment_id, v_order.mp_payment_id) then
      return query select 'already_processed'::text, false;
      return;
    end if;

    -- El MISMO pago se devolvió o se desconoció después: se avisa a los
    -- dueños. El stock (y el uso del cupón) no se tocan solos: vuelven al
    -- cancelar el pedido.
    if v_new = 'cancelled' then
      v_reason := v_name || ' informó que este pago se devolvió o se anuló. Si corresponde, cancelá el pedido para que vuelva el stock.';
      update public.orders
         set payment_status = 'cancelled',
             provider_status = p_status,
             payment_status_detail = p_status_detail,
             payment_notified_at = now(),
             mp_status = case when v_is_mp then p_status else mp_status end,
             mp_status_detail = case when v_is_mp then p_status_detail else mp_status_detail end,
             needs_review = true,
             review_reason = v_reason
       where id = p_order_id;
      perform public.log_order_event(p_order_id, 'needs_review', null, null, v_reason);
      return query select 'review'::text, false;
      return;
    end if;

    -- Ej.: un "rechazado" de un intento anterior que llega tarde.
    return query select 'already_processed'::text, false;
    return;
  end if;

  -- ---- El aviso no corresponde a este pedido ----------------------------
  if p_mismatch or p_provider is distinct from v_order.payment_provider then
    if v_new <> 'approved' then
      -- Un rechazo que no coincide no cambia nada.
      return query select 'ignored'::text, false;
      return;
    end if;
    v_reason := case
      when p_mismatch then format(
        '%s avisó un pago aprobado cuya referencia no coincide con este pedido. No se aprobó ni se descontó stock: buscalo en el portal de %s.',
        v_name, v_name)
      else format(
        'Llegó un pago aprobado de %s, pero este pedido se inició con otro medio de pago. No se aprobó ni se descontó stock.',
        v_name)
    end;
    update public.orders
       set needs_review = true,
           review_reason = v_reason,
           payment_notified_at = now()
     where id = p_order_id;
    if not v_order.needs_review then
      perform public.log_order_event(p_order_id, 'needs_review', null, null, v_reason);
    end if;
    return query select 'review'::text, false;
    return;
  end if;

  -- ---- Aprobado ahora ----------------------------------------------------
  if v_new = 'approved' then
    if coalesce(p_currency, '') <> 'ARS' or p_amount is null or p_amount <> v_order.total then
      v_reason := format(
        'El monto aprobado por %s (%s %s) no coincide con el total del pedido (ARS %s). No se descontó stock.',
        v_name, coalesce(p_currency, '?'), coalesce(p_amount::text, '?'), v_order.total);
      update public.orders
         set payment_id = p_payment_id,
             provider_status = p_status,
             payment_status_detail = p_status_detail,
             payment_notified_at = now(),
             mp_payment_id = case when v_is_mp then p_payment_id else mp_payment_id end,
             mp_status = case when v_is_mp then p_status else mp_status end,
             mp_status_detail = case when v_is_mp then p_status_detail else mp_status_detail end,
             needs_review = true,
             review_reason = v_reason
       where id = p_order_id;
      if not v_order.needs_review then
        perform public.log_order_event(p_order_id, 'needs_review', null, null, v_reason);
      end if;
      return query select 'review'::text, false;
      return;
    end if;

    if v_order.stock_applied_at is null then
      v_changed := public.apply_order_stock(p_order_id);
      v_issue := not v_changed;
    end if;

    -- Cupón: el uso se cuenta recién ahora (pago aprobado)
    v_coupon := public.redeem_order_coupon(p_order_id);

    update public.orders
       set payment_status = 'approved',
           fulfillment_status = 'paid',
           paid_at = coalesce(paid_at, now()),
           payment_id = p_payment_id,
           provider_status = p_status,
           payment_status_detail = p_status_detail,
           payment_notified_at = now(),
           mp_payment_id = case when v_is_mp then p_payment_id else mp_payment_id end,
           mp_status = case when v_is_mp then p_status else mp_status end,
           mp_status_detail = case when v_is_mp then p_status_detail else mp_status_detail end,
           stock_applied_at = case when v_changed then now() else stock_applied_at end,
           stock_issue = v_issue
     where id = p_order_id;

    perform public.log_order_event(
      p_order_id, 'payment_approved', v_order.fulfillment_status, 'paid',
      nullif(concat_ws(' — ',
        case when v_issue then 'Pagado sin stock: cuando llegó el pago ya no alcanzaba el stock. No se descontó nada.' end,
        v_coupon), ''));

    return query select 'approved'::text, v_changed;
    return;
  end if;

  -- ---- Pendiente, rechazado o cancelado (todavía sin aprobar) -----------
  -- No toca stock, cupón ni el estado de entrega (sigue "esperando el pago"):
  -- si después llega un "aprobado", se aprueba normal.
  update public.orders
     set payment_status = v_new,
         payment_id = p_payment_id,
         provider_status = p_status,
         payment_status_detail = p_status_detail,
         payment_notified_at = now(),
         mp_payment_id = case when v_is_mp then p_payment_id else mp_payment_id end,
         mp_status = case when v_is_mp then p_status else mp_status end,
         mp_status_detail = case when v_is_mp then p_status_detail else mp_status_detail end
   where id = p_order_id;

  return query select 'updated'::text, false;
end;
$$;

revoke all on function public.apply_order_payment(uuid, text, text, text, numeric, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_order_payment(uuid, text, text, text, numeric, text, text, boolean)
  to service_role;

-- ---------------------------------------------------------------------
-- 4. resolve_review(): igual que en el paso 7, pero "confirmar pago" mira
-- el estado de cualquier proveedor (provider_status; los pedidos viejos de
-- Mercado Pago, mp_status). Copia exacta de 20261201000001_cupones.sql.
-- ---------------------------------------------------------------------
create or replace function public.resolve_review(p_order_id uuid, p_mode text, p_note text default null)
returns table (approved boolean, stock_changed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o          public.orders%rowtype;
  v_note     text := left(nullif(trim(p_note), ''), 300);
  v_changed  boolean := false;
  v_issue    boolean := false;
  v_coupon   text;
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para cambiar pedidos' using errcode = '42501';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe.' using errcode = 'HD404';
  end if;
  if not o.needs_review then
    raise exception 'Este pedido ya no tiene el aviso "Para revisar".' using errcode = 'HD409';
  end if;

  if p_mode = 'dismiss' then
    if v_note is null then
      raise exception 'Contá brevemente qué revisaron.' using errcode = 'HD422';
    end if;
    update public.orders set needs_review = false, review_reason = null where id = p_order_id;
    perform public.log_order_event(p_order_id, 'issue_resolved', null, null, 'Revisado: ' || v_note);
    return query select false, false;
    return;
  end if;

  if p_mode = 'approve' then
    if o.payment_status = 'approved' or coalesce(o.provider_status, o.mp_status) is distinct from 'approved' then
      raise exception 'Este pedido no tiene un pago aprobado para confirmar.' using errcode = 'HD409';
    end if;
    if o.fulfillment_status <> 'awaiting_payment' then
      raise exception 'Este pedido no está esperando el pago.' using errcode = 'HD409';
    end if;

    if o.stock_applied_at is null then
      v_changed := public.apply_order_stock(p_order_id);
      v_issue := not v_changed;
    end if;

    v_coupon := public.redeem_order_coupon(p_order_id);

    update public.orders
       set payment_status = 'approved',
           fulfillment_status = 'paid',
           paid_at = coalesce(paid_at, now()),
           needs_review = false,
           review_reason = null,
           stock_applied_at = case when v_changed then now() else stock_applied_at end,
           stock_issue = v_issue
     where id = p_order_id;

    perform public.log_order_event(p_order_id, 'payment_approved', o.fulfillment_status, 'paid',
      concat_ws(' — ', 'Pago confirmado a mano', v_note,
        case when v_issue then 'Pagado sin stock: no alcanzaba el stock y no se descontó nada.' end,
        v_coupon));
    return query select true, v_changed;
    return;
  end if;

  raise exception 'Opción inválida.' using errcode = 'HD422';
end;
$$;

revoke all on function public.resolve_review(uuid, text, text) from public, anon;
grant execute on function public.resolve_review(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. forget_order_personal_data(): "Eliminar mi cuenta" (Ley 25.326)
--
-- Los pedidos se conservan (constancia de la venta), pero el DNI y la
-- dirección de facturación se borran. Se llama ANTES de borrar el usuario:
-- después, customer_id ya queda en null. Alcanza los pedidos de la cuenta y
-- los hechos como invitado con el mismo email (el de la cuenta, verificado).
-- Devuelve cuántos pedidos tocó. Solo service_role.
-- ---------------------------------------------------------------------
create or replace function public.forget_order_personal_data(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_count integer;
begin
  if not (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or session_user = 'postgres'
  ) then
    raise exception 'No tenés permiso para esta operación' using errcode = '42501';
  end if;
  if p_user is null then
    raise exception 'Falta el usuario' using errcode = 'HD422';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = p_user;

  update public.orders o
     set customer_dni = null,
         billing_street = null,
         billing_number = null,
         billing_postal_code = null
   where (o.customer_id = p_user
          or (v_email is not null and o.customer_id is null and o.customer_email = v_email))
     and (o.customer_dni is not null or o.billing_street is not null
          or o.billing_number is not null or o.billing_postal_code is not null);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.forget_order_personal_data(uuid) from public, anon, authenticated;
grant execute on function public.forget_order_personal_data(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 6. admin_home_attention(): cambia la tabla que devuelve → drop + create.
--    Mismo contrato que 20261203000001 + getnet_pending: pedidos con el pago
--    de Getnet iniciado hace más de 2 h y menos de 72 h (lo que Getnet
--    reintenta el aviso) sin ningún aviso recibido.
-- ---------------------------------------------------------------------
drop function public.admin_home_attention();

create function public.admin_home_attention()
returns table (
  to_prepare            bigint,
  stock_issue           bigint,
  needs_review          bigint,
  low_stock             bigint,
  out_of_stock          bigint,
  pending_withdrawals   bigint,
  getnet_pending        bigint,
  missing_email         boolean,
  missing_whatsapp      boolean,
  missing_business_name boolean,
  missing_cuit          boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para ver el inicio del panel' using errcode = '42501';
  end if;

  return query
  select
    o.n_prepare, o.n_stock_issue, o.n_review,
    s.n_low, s.n_out,
    w.n_new,
    g.n_getnet,
    coalesce(cfg.contact_email = '', true),
    coalesce(cfg.whatsapp = '', true),
    coalesce(trim(cfg.business_name) = '', true),
    coalesce(cfg.cuit = '', true)
  from (
    select
      count(*) filter (where ord.payment_status = 'approved' and ord.fulfillment_status = 'paid') as n_prepare,
      count(*) filter (where ord.stock_issue and ord.fulfillment_status <> 'cancelled')          as n_stock_issue,
      count(*) filter (where ord.needs_review)                                                   as n_review
    from public.orders ord
  ) o
  cross join (
    select
      count(*) filter (where pv.stock > 0 and pv.stock <= pv.min_stock) as n_low,
      count(*) filter (where pv.stock = 0)                              as n_out
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.is_active and p.status <> 'archived'
  ) s
  cross join (
    select count(*) as n_new from public.withdrawal_requests wr where wr.status = 'new'
  ) w
  cross join (
    select count(*) as n_getnet
      from public.orders og
     where og.payment_provider = 'getnet'
       and og.payment_intent_id is not null
       and og.payment_notified_at is null
       and og.payment_status = 'pending'
       and og.fulfillment_status = 'awaiting_payment'
       and og.created_at < now() - interval '2 hours'
       and og.created_at > now() - interval '72 hours'
  ) g
  left join public.store_settings cfg on true;
end;
$$;

revoke all on function public.admin_home_attention() from public, anon;
grant execute on function public.admin_home_attention() to authenticated;
