-- =====================================================================
-- Migración: pedidos y pago con Mercado Pago (paso 4)
-- ---------------------------------------------------------------------
-- Crea:
--   * orders       → cada pedido (y, desde ya, cada VENTA: tiene canal
--                    web/local y medio de pago para el futuro Módulo Local).
--   * order_items  → los productos del pedido, con la "foto" del momento:
--                    nombre, variante y precio tal como estaban al comprar.
--   * create_order()        → arma el pedido con precios de la BASE
--                             (nunca del navegador). Todo o nada.
--   * apply_order_payment() → la usa SOLO el webhook de Mercado Pago:
--                             confirma el pago y descuenta el stock una
--                             sola vez (idempotente).
--
-- Seguridad: los clientes y visitantes NO escriben estas tablas. Todo lo
-- escribe el servidor con la clave secreta (service_role). Los admins
-- leen todos los pedidos; un cliente con cuenta (paso 6), solo los suyos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------
create type public.order_channel as enum ('web', 'local');

create type public.payment_method as enum
  ('mercadopago', 'debito', 'credito', 'efectivo', 'transferencia');

-- Estado del PAGO (lo decide Mercado Pago, vía webhook)
create type public.payment_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create type public.delivery_method as enum ('shipping', 'pickup');

-- Estado de la ENTREGA (lo mueven los dueños desde el panel, paso 5)
--   Envío:  paid → preparing → shipped → delivered
--   Retiro: paid → preparing → ready_for_pickup → picked_up
--   Ambos:  awaiting_payment (todavía no se pagó) y cancelled
create type public.fulfillment_status as enum (
  'awaiting_payment', 'paid', 'preparing',
  'shipped', 'delivered',
  'ready_for_pickup', 'picked_up',
  'cancelled'
);

-- ---------------------------------------------------------------------
-- 2. orders
-- ---------------------------------------------------------------------
create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  -- Número amable para hablar con el cliente ("Pedido #1001")
  order_number        bigint generated always as identity (start with 1001) unique,
  -- Hash (sha256, hex) del link secreto que recibe el invitado para ver su
  -- pedido. El link en sí no se guarda: si alguien lee la tabla, no puede
  -- armar los links.
  access_token_hash   text check (access_token_hash ~ '^[0-9a-f]{64}$'),

  channel             public.order_channel not null default 'web',
  payment_method      public.payment_method not null default 'mercadopago',
  payment_status      public.payment_status not null default 'pending',
  fulfillment_status  public.fulfillment_status not null default 'awaiting_payment',
  delivery_method     public.delivery_method not null,

  -- Quién lo creó (usuario logueado) o null = la tienda, como invitado
  created_by          uuid references auth.users (id) on delete set null,
  -- Dueño del pedido para "Mis pedidos" (paso 6). Hoy queda vacío.
  customer_id         uuid references auth.users (id) on delete set null,

  -- Cliente
  customer_name       text not null check (char_length(trim(customer_name)) between 2 and 120),
  customer_email      text not null check (char_length(customer_email) <= 254 and customer_email like '%_@_%.__%'),
  customer_phone      text not null check (customer_phone ~ '^[0-9]{8,15}$'),

  -- Envío a domicilio
  ship_address        text check (char_length(ship_address) <= 200),
  ship_city           text check (char_length(ship_city) <= 100),
  ship_province       text check (char_length(ship_province) <= 60),
  ship_postal_code    text check (ship_postal_code ~ '^[A-Za-z]?[0-9]{4}[A-Za-z]{0,3}$'),
  -- Retiro en el local (copia de Configuración al momento de comprar)
  pickup_address      text,
  pickup_hours        text,

  -- Montos (todos calculados en la base)
  subtotal            numeric(12, 2) not null check (subtotal >= 0),
  shipping_cost       numeric(12, 2) not null default 0 check (shipping_cost >= 0),
  -- Lugar del cupón (paso 7): hoy siempre 0 y sin código
  discount_total      numeric(12, 2) not null default 0 check (discount_total >= 0),
  coupon_code         text,
  total               numeric(12, 2) not null check (total >= 0),

  -- Mercado Pago
  mp_preference_id    text,
  mp_payment_id       text,
  mp_status           text,          -- estado tal como lo informa MP
  mp_status_detail    text,
  mp_expires_at       timestamptz,   -- vence la preferencia (2 h)
  paid_at             timestamptz,

  -- Cuándo se descontó el stock. Si ya tiene fecha, no se descuenta otra vez.
  stock_applied_at    timestamptz,
  -- Se pagó, pero cuando llegó la aprobación ya no alcanzaba el stock
  -- (dos personas compraron la última unidad a la vez). Los dueños
  -- devuelven el dinero o le ofrecen otro producto.
  stock_issue         boolean not null default false,
  -- Algo no cerró (ej.: el monto pagado no coincide). No se aprobó ni se
  -- descontó stock: lo revisan los dueños.
  needs_review        boolean not null default false,
  review_reason       text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint orders_total_ok
    check (total = subtotal - discount_total + shipping_cost),
  constraint orders_shipping_data
    check (
      delivery_method = 'pickup'
      or (ship_address is not null and ship_city is not null
          and ship_province is not null and ship_postal_code is not null)
    ),
  -- Los estados de envío y de retiro no se mezclan
  constraint orders_fulfillment_matches_delivery
    check (
      fulfillment_status in ('awaiting_payment', 'paid', 'preparing', 'cancelled')
      or (delivery_method = 'shipping' and fulfillment_status in ('shipped', 'delivered'))
      or (delivery_method = 'pickup' and fulfillment_status in ('ready_for_pickup', 'picked_up'))
    )
);

create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (payment_status, fulfillment_status);
create index orders_customer_id_idx on public.orders (customer_id) where customer_id is not null;

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. order_items
-- ---------------------------------------------------------------------
create table public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete cascade,
  -- "set null": si algún día se borra el producto, el pedido conserva su
  -- foto (nombre, variante y precio) y no bloquea el borrado.
  variant_id         uuid references public.product_variants (id) on delete set null,
  product_id         uuid references public.products (id) on delete set null,
  product_name       text not null,
  variant_label      text,          -- "Rojo / 30 cm" (null si no tiene opciones)
  image_path         text,          -- foto principal al momento de comprar
  unit_price         numeric(12, 2) not null check (unit_price >= 0),  -- precio pagado
  unit_price_before  numeric(12, 2) check (unit_price_before >= 0),    -- sin descuento, si había
  quantity           integer not null check (quantity between 1 and 99),
  line_total         numeric(12, 2) not null check (line_total = unit_price * quantity),
  created_at         timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_variant_id_idx on public.order_items (variant_id);

-- El historial de stock ya tenía la columna order_id esperando esta tabla
alter table public.stock_movements
  add constraint stock_movements_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete set null;

-- ---------------------------------------------------------------------
-- 4. Seguridad (RLS)
-- ---------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.orders from public, anon, authenticated;
revoke all on public.order_items from public, anon, authenticated;

-- Solo lectura para usuarios logueados (las policies filtran qué filas).
-- El hash del link secreto no se puede leer desde la API.
grant select (
  id, order_number, channel, payment_method, payment_status, fulfillment_status,
  delivery_method, created_by, customer_id, customer_name, customer_email, customer_phone,
  ship_address, ship_city, ship_province, ship_postal_code, pickup_address, pickup_hours,
  subtotal, shipping_cost, discount_total, coupon_code, total,
  mp_preference_id, mp_payment_id, mp_status, mp_status_detail, mp_expires_at, paid_at,
  stock_applied_at, stock_issue, needs_review, review_reason, created_at, updated_at
) on public.orders to authenticated;
grant select on public.order_items to authenticated;

grant all on public.orders to service_role;
grant all on public.order_items to service_role;

create policy "Admins: ver todos los pedidos"
  on public.orders for select to authenticated
  using ((select public.is_admin()));

create policy "Clientes: ver sus pedidos"
  on public.orders for select to authenticated
  using (customer_id is not null and customer_id = (select auth.uid()));

create policy "Admins: ver los productos de los pedidos"
  on public.order_items for select to authenticated
  using ((select public.is_admin()));

create policy "Clientes: ver los productos de sus pedidos"
  on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_id
       and o.customer_id is not null
       and o.customer_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------
-- 5. create_order(p jsonb)
--
-- La llama el servidor (Server Action del checkout) con la clave secreta.
-- Recibe SOLO: datos del cliente, entrega y { variant_id, qty } de cada
-- producto. Los precios salen de store_variants y el envío de
-- store_settings, en este mismo momento.
--
-- Verifica que cada producto siga publicado y con stock suficiente. Si
-- algo falla, no se guarda nada y devuelve el error "sin_stock" (con la
-- lista de variantes en el detalle) o "no_disponible".
--
-- No descuenta stock: eso pasa recién cuando Mercado Pago aprueba el pago
-- (apply_order_payment).
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
  v_order_id   uuid;
  v_number     bigint;
  v_total      numeric(12, 2);
  v_bad        text;
begin
  -- Tablas de trabajo temporales (se borran solas al terminar la transacción)
  drop table if exists pg_temp._wanted;
  drop table if exists pg_temp._lines;

  -- Productos pedidos (si una variante viene dos veces, se suman)
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

  -- Precio, nombre, variante y foto de cada uno, tal como están HOY.
  -- store_variants ya excluye archivados, categorías ocultas y variantes
  -- inactivas. Los borradores los filtra el RLS... pero acá corre con la
  -- clave secreta (sin RLS), así que se exige "active" explícitamente.
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

  -- ¿Alguno ya no se vende?
  select string_agg(variant_id::text, ',') into v_bad
    from pg_temp._lines where product_name is null or unit_price is null;
  if v_bad is not null then
    raise exception 'no_disponible' using detail = v_bad;
  end if;

  -- ¿Alcanza el stock? (No se reserva: se vuelve a verificar al aprobarse.)
  select string_agg(variant_id::text, ',') into v_bad
    from pg_temp._lines where stock < qty;
  if v_bad is not null then
    raise exception 'sin_stock' using detail = v_bad;
  end if;

  -- Envío y datos del local, de Configuración (una sola fila)
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
    access_token_hash, delivery_method, created_by,
    customer_name, customer_email, customer_phone,
    ship_address, ship_city, ship_province, ship_postal_code,
    pickup_address, pickup_hours,
    subtotal, shipping_cost, discount_total, total
  ) values (
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
  returning id, orders.order_number into v_order_id, v_number;

  insert into public.order_items (
    order_id, variant_id, product_id, product_name, variant_label, image_path,
    unit_price, unit_price_before, quantity, line_total
  )
  select v_order_id, l.variant_id, l.product_id, l.product_name, l.variant_label, l.image_path,
         l.unit_price, l.unit_price_before, l.qty, round(l.unit_price * l.qty, 2)
    from pg_temp._lines l
   order by l.product_name, l.variant_label;

  return query select v_order_id, v_number, v_total;
end;
$$;

revoke all on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;

-- ---------------------------------------------------------------------
-- 6. apply_order_payment(...)
--
-- La llama SOLO el webhook, con los datos que el servidor consultó a la
-- API de Mercado Pago (nunca con lo que llega en la notificación).
--
-- Devuelve:
--   result:  'not_found' | 'ignored' | 'already_processed' | 'updated'
--            | 'approved' | 'review'
--   stock_changed: true si descontó stock (hay que refrescar la tienda)
--
-- Idempotente: el pedido se bloquea ("for update") mientras se procesa,
-- así dos avisos simultáneos del mismo pago se atienden de a uno, y el
-- stock se descuenta solo si stock_applied_at está vacío.
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
  r         record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    return query select 'not_found'::text, false;
    return;
  end if;

  -- Estados de Mercado Pago → los nuestros
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
    -- Un aviso viejo de OTRO intento (ej.: una tarjeta rechazada antes de
    -- la que pagó) no puede "bajar" un pedido aprobado.
    if p_payment_id is distinct from v_order.mp_payment_id then
      return query select 'already_processed'::text, false;
      return;
    end if;

    -- El MISMO pago se devolvió o se desconoció después: se avisa a los
    -- dueños. El stock no se toca solo (cancelar y devolver stock es una
    -- decisión del panel, paso 5).
    if v_new = 'cancelled' then
      update public.orders
         set payment_status = 'cancelled',
             mp_status = p_status,
             mp_status_detail = p_status_detail,
             needs_review = true,
             review_reason = 'Mercado Pago informó que este pago se devolvió o se anuló. Revisá el pedido antes de prepararlo.'
       where id = p_order_id;
      return query select 'updated'::text, false;
      return;
    end if;

    return query select 'already_processed'::text, false;
    return;
  end if;

  -- ---- Aprobado ahora ----------------------------------------------------
  if v_new = 'approved' then
    -- Control de monto: lo cobrado (transaction_amount, sin intereses de
    -- cuotas) tiene que ser igual al total del pedido, y en pesos.
    if coalesce(p_currency, '') <> 'ARS' or p_amount is null or p_amount <> v_order.total then
      update public.orders
         set mp_payment_id = p_payment_id,
             mp_status = p_status,
             mp_status_detail = p_status_detail,
             needs_review = true,
             review_reason = format(
               'El monto aprobado por Mercado Pago (%s %s) no coincide con el total del pedido (ARS %s). No se descontó stock.',
               coalesce(p_currency, '?'), coalesce(p_amount::text, '?'), v_order.total)
       where id = p_order_id;
      return query select 'review'::text, false;
      return;
    end if;

    if v_order.stock_applied_at is null then
      -- Bloquear TODAS las variantes del pedido, siempre en el mismo orden
      -- (por id) para que dos pedidos simultáneos no se traben entre sí.
      perform 1
         from public.product_variants pv
        where pv.id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order_id)
        order by pv.id
          for update;

      -- ¿Alcanza para TODO el pedido? (todo o nada)
      select exists (
        select 1
          from (select oi.variant_id, sum(oi.quantity) as qty
                  from public.order_items oi
                 where oi.order_id = p_order_id
                 group by oi.variant_id) i
          left join public.product_variants pv on pv.id = i.variant_id
         where pv.id is null or pv.stock < i.qty
      ) into v_issue;

      if not v_issue then
        for r in
          select oi.variant_id, sum(oi.quantity)::integer as qty
            from public.order_items oi
           where oi.order_id = p_order_id
           group by oi.variant_id
           order by oi.variant_id
        loop
          perform public.adjust_stock(
            r.variant_id, -r.qty, 'venta_web',
            'Pedido #' || v_order.order_number, p_order_id);
        end loop;
        v_changed := true;
      end if;
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

    return query select 'approved'::text, v_changed;
    return;
  end if;

  -- ---- Pendiente, rechazado o cancelado (todavía sin aprobar) -----------
  -- Si se rechaza, el cliente puede volver a intentar con la misma
  -- preferencia mientras no venza: la entrega sigue "esperando el pago".
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
