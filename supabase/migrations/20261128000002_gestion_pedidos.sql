-- =====================================================================
-- Migración: gestión de pedidos en el panel (paso 5)
-- ---------------------------------------------------------------------
-- Crea:
--   * Columnas de despacho en orders (empresa, código de seguimiento y
--     la fecha de cada estado).
--   * order_events → la LÍNEA DE TIEMPO de cada pedido (qué pasó, quién
--     y cuándo). Solo la escriben las funciones de la base y el servidor.
--   * Funciones para los dueños (todas validan is_admin() primero):
--       set_order_status()      → avanzar el estado (con reglas: nunca
--                                 hacia atrás, envío y retiro separados)
--       mark_orders_preparing() → "Preparando" para varios a la vez
--       cancel_order()          → cancela y devuelve el stock
--       resolve_stock_issue()   → resolver "Pagado sin stock"
--       resolve_review()        → resolver "Para revisar"
--       admin_order_counts()    → contadores de las pestañas
--   * create_order() y apply_order_payment() se vuelven a crear SOLO para
--     anotar en la línea de tiempo (y create_order acepta el id del pedido
--     armado por el servidor, para el link secreto). Su lógica no cambia.
--
-- Errores: código HD4xx con un mensaje pensado para mostrar tal cual en
-- el panel (42501 = sin permiso).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Empresa de envío y columnas de despacho
-- ---------------------------------------------------------------------
create type public.shipping_carrier as enum ('correo_argentino', 'andreani', 'oca', 'otra');

alter table public.orders
  add column carrier            public.shipping_carrier,
  -- Nombre de la empresa cuando es "Otra"
  add column carrier_name       text check (char_length(carrier_name) between 1 and 60),
  add column tracking_code      text check (char_length(tracking_code) between 1 and 60),
  -- Link de seguimiento, solo para "Otra" (las demás se arman solas)
  add column tracking_url       text check (tracking_url ~ '^https?://' and char_length(tracking_url) <= 500),
  add column preparing_at       timestamptz,
  add column shipped_at         timestamptz,
  add column delivered_at       timestamptz,
  add column ready_at           timestamptz,
  add column picked_up_at       timestamptz,
  add column cancelled_at       timestamptz,
  add column cancel_reason      text check (char_length(cancel_reason) <= 300),
  -- Cuándo se devolvió el stock al cancelar (si tiene fecha, no se devuelve otra vez)
  add column stock_returned_at  timestamptz,
  -- Enviado = siempre con empresa y código
  add constraint orders_tracking_when_shipped
    check (fulfillment_status not in ('shipped', 'delivered')
           or (carrier is not null and tracking_code is not null)),
  add constraint orders_other_carrier_name
    check (carrier is distinct from 'otra' or carrier_name is not null);

-- Las columnas nuevas también se leen desde el panel (grant por columna)
grant select (
  carrier, carrier_name, tracking_code, tracking_url,
  preparing_at, shipped_at, delivered_at, ready_at, picked_up_at,
  cancelled_at, cancel_reason, stock_returned_at
) on public.orders to authenticated;

-- ---------------------------------------------------------------------
-- 2. order_events (línea de tiempo)
-- ---------------------------------------------------------------------
create type public.order_event_kind as enum (
  'created',          -- el cliente armó el pedido (todavía sin pagar)
  'payment_approved', -- Mercado Pago aprobó el pago (o un admin lo aprobó a mano)
  'needs_review',     -- quedó "Para revisar"
  'status',           -- cambio de estado (from_status → to_status)
  'tracking_updated', -- se corrigió la empresa o el código de seguimiento
  'cancelled',
  'stock_returned',   -- volvió el stock por la cancelación
  'issue_resolved',   -- se resolvió "Pagado sin stock" o "Para revisar"
  'email_sent',
  'email_failed'      -- también "no se mandó" (ej.: falta configurar el email)
);

create table public.order_events (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  kind         public.order_event_kind not null,
  from_status  public.fulfillment_status,
  to_status    public.fulfillment_status,
  note         text check (char_length(note) <= 500),
  -- Quién lo hizo. El nombre se copia en el momento: la tabla profiles
  -- solo le deja leer a cada uno su propio perfil. null = la tienda / el sistema.
  actor_id     uuid references auth.users (id) on delete set null,
  actor_name   text,
  created_at   timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

alter table public.order_events enable row level security;
revoke all on public.order_events from public, anon, authenticated;
grant select on public.order_events to authenticated;
grant all on public.order_events to service_role;

create policy "Admins: ver la línea de tiempo de los pedidos"
  on public.order_events for select to authenticated
  using ((select public.is_admin()));

-- Anota un evento con el usuario actual como autor (si hay uno).
-- Uso interno: la llaman las demás funciones (y el servidor, con la clave secreta).
create or replace function public.log_order_event(
  p_order_id  uuid,
  p_kind      public.order_event_kind,
  p_from      public.fulfillment_status default null,
  p_to        public.fulfillment_status default null,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_name  text;
begin
  if v_actor is not null then
    select coalesce(nullif(trim(p.full_name), ''), p.email) into v_name
      from public.profiles p where p.id = v_actor;
  end if;
  insert into public.order_events (order_id, kind, from_status, to_status, note, actor_id, actor_name)
  values (p_order_id, p_kind, p_from, p_to, left(nullif(trim(p_note), ''), 500), v_actor, v_name);
end;
$$;

revoke all on function public.log_order_event(uuid, public.order_event_kind, public.fulfillment_status, public.fulfillment_status, text)
  from public, anon, authenticated;
grant execute on function public.log_order_event(uuid, public.order_event_kind, public.fulfillment_status, public.fulfillment_status, text)
  to service_role;

-- Eventos de los pedidos que ya existían (para que su línea de tiempo no arranque vacía)
insert into public.order_events (order_id, kind, to_status, created_at)
select id, 'created', 'awaiting_payment', created_at from public.orders;
insert into public.order_events (order_id, kind, from_status, to_status, created_at)
select id, 'payment_approved', 'awaiting_payment', 'paid', paid_at
  from public.orders where paid_at is not null;

-- Texto de cada estado, para los mensajes de error
create or replace function public.fulfillment_label(p public.fulfillment_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p
    when 'awaiting_payment' then 'Esperando el pago'
    when 'paid' then 'Para preparar'
    when 'preparing' then 'Preparando'
    when 'shipped' then 'Enviado'
    when 'delivered' then 'Entregado'
    when 'ready_for_pickup' then 'Listo para retirar'
    when 'picked_up' then 'Retirado'
    when 'cancelled' then 'Cancelado'
  end;
$$;

-- Solo la usan las funciones de abajo (corren como dueño): nadie más la necesita.
revoke all on function public.fulfillment_label(public.fulfillment_status) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. apply_order_stock(): descuenta el stock de TODO el pedido o de nada
--
-- La usan el webhook (al aprobarse el pago) y los dueños al resolver
-- "Pagado sin stock" o aprobar a mano. Devuelve true si descontó y false
-- si no alcanza (no toca nada). No cambia el pedido: eso lo hace quien la llama.
-- ---------------------------------------------------------------------
create or replace function public.apply_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number bigint;
  v_short  boolean;
  r        record;
begin
  if not (
    (select public.is_admin())
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or session_user = 'postgres'
  ) then
    raise exception 'No tenés permiso para cambiar pedidos' using errcode = '42501';
  end if;

  select o.order_number into v_number from public.orders o where o.id = p_order_id;

  -- Bloquear TODAS las variantes del pedido, siempre en el mismo orden
  -- (por id) para que dos pedidos simultáneos no se traben entre sí.
  perform 1
     from public.product_variants pv
    where pv.id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order_id)
    order by pv.id
      for update;

  select exists (
    select 1
      from (select oi.variant_id, sum(oi.quantity) as qty
              from public.order_items oi
             where oi.order_id = p_order_id
             group by oi.variant_id) i
      left join public.product_variants pv on pv.id = i.variant_id
     where pv.id is null or pv.stock < i.qty
  ) into v_short;

  if v_short then
    return false;
  end if;

  for r in
    select oi.variant_id, sum(oi.quantity)::integer as qty
      from public.order_items oi
     where oi.order_id = p_order_id
     group by oi.variant_id
     order by oi.variant_id
  loop
    perform public.adjust_stock(r.variant_id, -r.qty, 'venta_web', 'Pedido #' || v_number, p_order_id);
  end loop;
  return true;
end;
$$;

revoke all on function public.apply_order_stock(uuid) from public, anon, authenticated;
grant execute on function public.apply_order_stock(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 4. create_order(): igual que antes + id armado por el servidor + evento
--
-- p ->> 'id' (opcional): el servidor genera el id ANTES de crear el pedido
-- para calcular el link secreto (que se deriva del id). Si no viene, la
-- base genera uno como siempre.
-- ---------------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns table (order_id uuid, order_number bigint, total numeric)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_delivery   public.delivery_method := (p ->> 'delivery_method')::public.delivery_method;
  v_shipping   numeric(12, 2);
  v_address    text;
  v_hours      text;
  v_subtotal   numeric(12, 2);
  v_order_id   uuid := coalesce(nullif(p ->> 'id', '')::uuid, gen_random_uuid());
  v_number     bigint;
  v_total      numeric(12, 2);
  v_bad        text;
begin
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
  v_total := v_subtotal + v_shipping;  -- el cupón (paso 7) se restará acá

  insert into public.orders (
    id, access_token_hash, delivery_method, created_by,
    customer_name, customer_email, customer_phone,
    ship_address, ship_city, ship_province, ship_postal_code,
    pickup_address, pickup_hours,
    subtotal, shipping_cost, discount_total, total
  ) values (
    v_order_id,
    p ->> 'access_token_hash',
    v_delivery,
    nullif(p ->> 'created_by', '')::uuid,
    trim(p ->> 'customer_name'),
    lower(trim(p ->> 'customer_email')),
    p ->> 'customer_phone',
    case when v_delivery = 'shipping' then trim(p ->> 'ship_address') end,
    case when v_delivery = 'shipping' then trim(p ->> 'ship_city') end,
    case when v_delivery = 'shipping' then p ->> 'ship_province' end,
    case when v_delivery = 'shipping' then upper(trim(p ->> 'ship_postal_code')) end,
    case when v_delivery = 'pickup' then v_address end,
    case when v_delivery = 'pickup' then v_hours end,
    v_subtotal, v_shipping, 0, v_total
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

  perform public.log_order_event(v_order_id, 'created', null, 'awaiting_payment');

  return query select v_order_id, v_number, v_total;
end;
$$;

revoke all on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;

-- ---------------------------------------------------------------------
-- 5. apply_order_payment(): igual que antes + eventos
--    (el descuento de stock ahora vive en apply_order_stock)
-- ---------------------------------------------------------------------
create or replace function public.apply_order_payment(
  p_order_id       uuid,
  p_payment_id     text,
  p_status         text,
  p_status_detail  text,
  p_amount         numeric,
  p_currency       text
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
begin
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
    if p_payment_id is distinct from v_order.mp_payment_id then
      return query select 'already_processed'::text, false;
      return;
    end if;

    -- El MISMO pago se devolvió o se desconoció después: se avisa a los
    -- dueños. El stock no se toca solo: se devuelve al cancelar el pedido.
    if v_new = 'cancelled' then
      v_reason := 'Mercado Pago informó que este pago se devolvió o se anuló. Si corresponde, cancelá el pedido para que vuelva el stock.';
      update public.orders
         set payment_status = 'cancelled',
             mp_status = p_status,
             mp_status_detail = p_status_detail,
             needs_review = true,
             review_reason = v_reason
       where id = p_order_id;
      perform public.log_order_event(p_order_id, 'needs_review', null, null, v_reason);
      return query select 'review'::text, false;
      return;
    end if;

    return query select 'already_processed'::text, false;
    return;
  end if;

  -- ---- Aprobado ahora ----------------------------------------------------
  if v_new = 'approved' then
    if coalesce(p_currency, '') <> 'ARS' or p_amount is null or p_amount <> v_order.total then
      v_reason := format(
        'El monto aprobado por Mercado Pago (%s %s) no coincide con el total del pedido (ARS %s). No se descontó stock.',
        coalesce(p_currency, '?'), coalesce(p_amount::text, '?'), v_order.total);
      update public.orders
         set mp_payment_id = p_payment_id,
             mp_status = p_status,
             mp_status_detail = p_status_detail,
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

    update public.orders
       set payment_status = 'approved',
           fulfillment_status = 'paid',
           paid_at = coalesce(paid_at, now()),
           mp_payment_id = p_payment_id,
           mp_status = p_status,
           mp_status_detail = p_status_detail,
           stock_applied_at = case when v_changed then now() else stock_applied_at end,
           stock_issue = v_issue
     where id = p_order_id;

    perform public.log_order_event(
      p_order_id, 'payment_approved', v_order.fulfillment_status, 'paid',
      case when v_issue then 'Pagado sin stock: cuando llegó el pago ya no alcanzaba el stock. No se descontó nada.' end);

    return query select 'approved'::text, v_changed;
    return;
  end if;

  -- ---- Pendiente, rechazado o cancelado (todavía sin aprobar) -----------
  update public.orders
     set payment_status = v_new,
         mp_payment_id = p_payment_id,
         mp_status = p_status,
         mp_status_detail = p_status_detail
   where id = p_order_id;

  return query select 'updated'::text, false;
end;
$$;

revoke all on function public.apply_order_payment(uuid, text, text, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.apply_order_payment(uuid, text, text, text, numeric, text)
  to service_role;

-- ---------------------------------------------------------------------
-- 6. set_order_status(): avanzar el estado de UN pedido
--
--   Envío:  paid → preparing → shipped → delivered   (se puede saltear "preparing")
--   Retiro: paid → preparing → ready_for_pickup → picked_up
--   shipped → shipped = corregir la empresa o el código de seguimiento.
--
-- Nunca hacia atrás. Solo pedidos pagados y sin avisos pendientes
-- ("Pagado sin stock" / "Para revisar" se resuelven primero).
-- ---------------------------------------------------------------------
create or replace function public.set_order_status(
  p_order_id       uuid,
  p_to             public.fulfillment_status,
  p_carrier        public.shipping_carrier default null,
  p_carrier_name   text default null,
  p_tracking_code  text default null,
  p_tracking_url   text default null
)
returns public.fulfillment_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  o        public.orders%rowtype;
  v_ok     boolean;
  v_code   text := nullif(trim(p_tracking_code), '');
  v_name   text := nullif(trim(p_carrier_name), '');
  v_url    text := nullif(trim(p_tracking_url), '');
  v_label  text;
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para cambiar pedidos' using errcode = '42501';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe.' using errcode = 'HD404';
  end if;
  if o.fulfillment_status = 'cancelled' then
    raise exception 'El pedido está cancelado.' using errcode = 'HD409';
  end if;
  if o.payment_status <> 'approved' then
    raise exception 'Este pedido no tiene el pago aprobado.' using errcode = 'HD409';
  end if;
  if o.stock_issue then
    raise exception 'Primero resolvé el aviso "Pagado sin stock".' using errcode = 'HD409';
  end if;
  if o.needs_review then
    raise exception 'Primero resolvé el aviso "Para revisar".' using errcode = 'HD409';
  end if;

  v_ok := case p_to
    when 'preparing'        then o.fulfillment_status = 'paid'
    when 'shipped'          then o.delivery_method = 'shipping' and o.fulfillment_status in ('paid', 'preparing', 'shipped')
    when 'delivered'        then o.delivery_method = 'shipping' and o.fulfillment_status = 'shipped'
    when 'ready_for_pickup' then o.delivery_method = 'pickup' and o.fulfillment_status in ('paid', 'preparing')
    when 'picked_up'        then o.delivery_method = 'pickup' and o.fulfillment_status = 'ready_for_pickup'
    else false
  end;
  if not v_ok then
    raise exception 'No se puede pasar de "%" a "%".',
      public.fulfillment_label(o.fulfillment_status), public.fulfillment_label(p_to)
      using errcode = 'HD409';
  end if;

  -- ---- Enviado (o corrección del seguimiento) ---------------------------
  if p_to = 'shipped' then
    if p_carrier is null then
      raise exception 'Elegí la empresa de envío.' using errcode = 'HD422';
    end if;
    if v_code is null or char_length(v_code) > 60 then
      raise exception 'Escribí el código de seguimiento.' using errcode = 'HD422';
    end if;
    if p_carrier = 'otra' and (v_name is null or char_length(v_name) > 60) then
      raise exception 'Escribí el nombre de la empresa de envío.' using errcode = 'HD422';
    end if;
    if v_url is not null and (v_url !~ '^https?://' or char_length(v_url) > 500) then
      raise exception 'El link de seguimiento tiene que empezar con https://' using errcode = 'HD422';
    end if;

    v_label := case p_carrier
      when 'correo_argentino' then 'Correo Argentino'
      when 'andreani' then 'Andreani'
      when 'oca' then 'OCA'
      else v_name
    end || ' · ' || v_code;

    update public.orders
       set fulfillment_status = 'shipped',
           carrier = p_carrier,
           carrier_name = case when p_carrier = 'otra' then v_name end,
           tracking_code = v_code,
           tracking_url = case when p_carrier = 'otra' then v_url end,
           shipped_at = coalesce(shipped_at, now())
     where id = p_order_id;

    if o.fulfillment_status = 'shipped' then
      perform public.log_order_event(p_order_id, 'tracking_updated', null, null, v_label);
    else
      perform public.log_order_event(p_order_id, 'status', o.fulfillment_status, 'shipped', v_label);
    end if;
    return 'shipped';
  end if;

  update public.orders
     set fulfillment_status = p_to,
         preparing_at = case when p_to = 'preparing' then now() else preparing_at end,
         delivered_at = case when p_to = 'delivered' then now() else delivered_at end,
         ready_at     = case when p_to = 'ready_for_pickup' then now() else ready_at end,
         picked_up_at = case when p_to = 'picked_up' then now() else picked_up_at end
   where id = p_order_id;

  perform public.log_order_event(p_order_id, 'status', o.fulfillment_status, p_to);
  return p_to;
end;
$$;

revoke all on function public.set_order_status(uuid, public.fulfillment_status, public.shipping_carrier, text, text, text)
  from public, anon;
grant execute on function public.set_order_status(uuid, public.fulfillment_status, public.shipping_carrier, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------
-- 7. mark_orders_preparing(): "Preparando" para varios pedidos a la vez
--
-- Cada pedido por separado: si uno no puede (ej.: ya estaba enviado), se
-- saltea con el motivo y los demás pasan igual.
-- ---------------------------------------------------------------------
create or replace function public.mark_orders_preparing(p_ids uuid[])
returns table (order_id uuid, order_number bigint, ok boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para cambiar pedidos' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_ids), 0) = 0 or cardinality(p_ids) > 200 then
    raise exception 'Elegí entre 1 y 200 pedidos.' using errcode = 'HD422';
  end if;

  for r in
    select o.id, o.order_number from public.orders o
     where o.id = any (p_ids)
     order by o.order_number
  loop
    begin
      perform public.set_order_status(r.id, 'preparing');
      return query select r.id, r.order_number, true, null::text;
    exception when others then
      -- Bloque con su propio "punto de guardado": si falla, se deshace solo ese pedido
      return query select r.id, r.order_number, false, sqlerrm;
    end;
  end loop;
end;
$$;

revoke all on function public.mark_orders_preparing(uuid[]) from public, anon;
grant execute on function public.mark_orders_preparing(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- 8. cancel_order(): cancela y devuelve el stock
--
-- Se puede cancelar un pedido pagado que todavía no salió (Para preparar,
-- Preparando o Listo para retirar). Si el stock se había descontado,
-- vuelve con adjust_stock(…, 'cancelacion') UNA sola vez.
-- El dinero NO se devuelve solo: eso se hace desde Mercado Pago.
-- Devuelve cuántas unidades volvieron al stock.
-- ---------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid, p_reason text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  o         public.orders%rowtype;
  v_units   integer := 0;
  v_reason  text := left(nullif(trim(p_reason), ''), 300);
  r         record;
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para cambiar pedidos' using errcode = '42501';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe.' using errcode = 'HD404';
  end if;
  if o.fulfillment_status = 'cancelled' then
    raise exception 'El pedido ya está cancelado.' using errcode = 'HD409';
  end if;
  if o.fulfillment_status not in ('paid', 'preparing', 'ready_for_pickup') then
    raise exception 'Un pedido "%" no se puede cancelar.', public.fulfillment_label(o.fulfillment_status)
      using errcode = 'HD409';
  end if;

  -- Devolver el stock (solo si se había descontado y todavía no se devolvió)
  if o.stock_applied_at is not null and o.stock_returned_at is null then
    for r in
      select oi.variant_id, sum(oi.quantity)::integer as qty
        from public.order_items oi
        join public.product_variants pv on pv.id = oi.variant_id  -- las variantes borradas se saltean
       where oi.order_id = p_order_id
       group by oi.variant_id
       order by oi.variant_id
    loop
      perform public.adjust_stock(r.variant_id, r.qty, 'cancelacion',
        'Pedido #' || o.order_number || ' cancelado', p_order_id);
      v_units := v_units + r.qty;
    end loop;
  end if;

  update public.orders
     set fulfillment_status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = v_reason,
         stock_returned_at = case
           when o.stock_applied_at is not null and o.stock_returned_at is null then now()
           else stock_returned_at end,
         stock_issue = false,
         needs_review = false
   where id = p_order_id;

  perform public.log_order_event(p_order_id, 'cancelled', o.fulfillment_status, 'cancelled', v_reason);
  if v_units > 0 then
    perform public.log_order_event(p_order_id, 'stock_returned', null, null,
      case when v_units = 1 then 'Volvió 1 unidad al stock' else 'Volvieron ' || v_units || ' unidades al stock' end);
  end if;
  return v_units;
end;
$$;

revoke all on function public.cancel_order(uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 9. resolve_stock_issue(): resolver "Pagado sin stock"
--   'apply_stock' → ya hay stock: se descuenta (todo o nada) y sigue a "Para preparar"
--   'manual'      → lo resolvieron de otra forma (nota obligatoria). No toca el stock.
--   (Cancelar = cancel_order.)
-- Devuelve true si descontó stock.
-- ---------------------------------------------------------------------
create or replace function public.resolve_stock_issue(p_order_id uuid, p_mode text, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  o        public.orders%rowtype;
  v_note   text := left(nullif(trim(p_note), ''), 300);
  v_done   boolean := false;
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para cambiar pedidos' using errcode = '42501';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'El pedido no existe.' using errcode = 'HD404';
  end if;
  if not o.stock_issue then
    raise exception 'Este pedido ya no tiene el aviso "Pagado sin stock".' using errcode = 'HD409';
  end if;

  if p_mode = 'apply_stock' then
    if o.stock_applied_at is null then
      v_done := public.apply_order_stock(p_order_id);
      if not v_done then
        raise exception 'Todavía no hay stock suficiente para todo el pedido. Cargá el ingreso en Stock o elegí otra opción.'
          using errcode = 'HD409';
      end if;
    end if;
    update public.orders
       set stock_issue = false,
           stock_applied_at = case when v_done then now() else stock_applied_at end
     where id = p_order_id;
    perform public.log_order_event(p_order_id, 'issue_resolved', null, null,
      concat_ws(' — ', 'Pagado sin stock: se descontó el stock y sigue el pedido', v_note));
  elsif p_mode = 'manual' then
    if v_note is null then
      raise exception 'Contá brevemente cómo lo resolvieron (por ejemplo: "Le mandamos otro color").'
        using errcode = 'HD422';
    end if;
    update public.orders set stock_issue = false where id = p_order_id;
    perform public.log_order_event(p_order_id, 'issue_resolved', null, null,
      'Pagado sin stock: ' || v_note);
  else
    raise exception 'Opción inválida.' using errcode = 'HD422';
  end if;

  return v_done;
end;
$$;

revoke all on function public.resolve_stock_issue(uuid, text, text) from public, anon;
grant execute on function public.resolve_stock_issue(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 10. resolve_review(): resolver "Para revisar"
--   'dismiss' → revisado, sigue como estaba (nota obligatoria)
--   'approve' → SOLO si Mercado Pago aprobó pero el monto no coincidía:
--               se aprueba a mano y se descuenta el stock como en el webhook
--   (Pagos devueltos → cancel_order.)
-- Devuelve: approved (si se aprobó ahora) y stock_changed.
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
    if o.payment_status = 'approved' or o.mp_status is distinct from 'approved' then
      raise exception 'Este pedido no tiene un pago aprobado por Mercado Pago para confirmar.' using errcode = 'HD409';
    end if;
    if o.fulfillment_status <> 'awaiting_payment' then
      raise exception 'Este pedido no está esperando el pago.' using errcode = 'HD409';
    end if;

    if o.stock_applied_at is null then
      v_changed := public.apply_order_stock(p_order_id);
      v_issue := not v_changed;
    end if;

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
        case when v_issue then 'Pagado sin stock: no alcanzaba el stock y no se descontó nada.' end));
    return query select true, v_changed;
    return;
  end if;

  raise exception 'Opción inválida.' using errcode = 'HD422';
end;
$$;

revoke all on function public.resolve_review(uuid, text, text) from public, anon;
grant execute on function public.resolve_review(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 11. admin_order_counts(): contadores de las pestañas del panel
-- security invoker: pasa por el RLS (a un no-admin le da todo en 0).
-- ---------------------------------------------------------------------
create or replace function public.admin_order_counts()
returns table (
  to_prepare   bigint,
  preparing    bigint,
  shipped      bigint,
  to_pickup    bigint,
  done         bigint,
  all_orders   bigint,
  stock_issue  bigint,
  needs_review bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (where payment_status = 'approved' and fulfillment_status = 'paid'),
    count(*) filter (where payment_status = 'approved' and fulfillment_status = 'preparing'),
    count(*) filter (where payment_status = 'approved' and fulfillment_status = 'shipped'),
    count(*) filter (where payment_status = 'approved' and fulfillment_status = 'ready_for_pickup'),
    count(*) filter (where fulfillment_status in ('delivered', 'picked_up')),
    count(*) filter (where payment_status = 'approved' or needs_review or fulfillment_status = 'cancelled'),
    count(*) filter (where stock_issue and fulfillment_status <> 'cancelled'),
    count(*) filter (where needs_review)
  from public.orders;
$$;

revoke all on function public.admin_order_counts() from public, anon;
grant execute on function public.admin_order_counts() to authenticated;
