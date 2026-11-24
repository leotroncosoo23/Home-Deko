-- =====================================================================
-- Migración: cupones de descuento (paso 7)
-- ---------------------------------------------------------------------
-- Crea:
--   * coupons             → los cupones que crean los dueños en el panel.
--   * coupon_redemptions  → cada USO de un cupón (= un pedido con el pago
--                           aprobado). Si el pedido se cancela, el uso se
--                           "libera" (released_at) y vuelve a estar disponible.
--   * coupon_attempts     → límite de intentos del checkout (10 por minuto
--                           por visitante) para que no se prueben códigos al azar.
--   * admin_coupons       → vista del panel: cupón + usos, total descontado y estado.
--
--   Funciones del PANEL (security definer, is_admin() primero):
--     save_coupon(), set_coupon_active(), delete_coupon()
--   Funciones del CHECKOUT (solo service_role, nunca desde el navegador):
--     coupon_quote()   → calcula el descuento sin guardar nada
--     coupon_attempt() → cuenta un intento (límite por visitante)
--     create_order()   → ahora acepta coupon_code y guarda el descuento
--   Internas:
--     redeem_order_coupon() → cuenta el uso al aprobarse el pago
--   Se recrean (copia exacta + cupón): apply_order_payment(),
--   resolve_review() y cancel_order().
--
-- Regla del MEJOR PRECIO (CLAUDE.md): si un producto ya tiene descuento y
-- hay cupón, NO se suman: se aplica lo que más le conviene al cliente.
-- Ver coupon_quote() para el detalle del cálculo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------
create type public.coupon_kind as enum ('percent', 'fixed', 'free_shipping');

create table public.coupons (
  id                uuid primary key default gen_random_uuid(),
  -- Siempre en mayúsculas, sin espacios: lo normalizan save_coupon y la app
  code              text not null unique check (code ~ '^[A-Z0-9-]{3,30}$'),
  kind              public.coupon_kind not null,
  -- percent: 1 a 100 · fixed: monto en pesos · free_shipping: sin valor
  value             numeric(12, 2),
  -- Días de Argentina (opcionales): vale desde las 00:00 del "desde" hasta
  -- las 23:59 del "hasta".
  starts_on         date,
  ends_on           date,
  max_uses          integer check (max_uses > 0),
  one_per_customer  boolean not null default false,
  min_purchase      numeric(12, 2) check (min_purchase > 0),
  is_active         boolean not null default true,
  created_by        uuid references auth.users (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint coupons_value_ok check (
    (kind = 'percent' and value between 1 and 100)
    or (kind = 'fixed' and value > 0)
    or (kind = 'free_shipping' and value is null)
  ),
  constraint coupons_dates_ok check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- Un uso = un pedido aprobado. Lo escribe SOLO redeem_order_coupon().
create table public.coupon_redemptions (
  id               uuid primary key default gen_random_uuid(),
  -- restrict: un cupón con usos no se puede borrar (solo pausar)
  coupon_id        uuid not null references public.coupons (id) on delete restrict,
  -- unique: aunque el webhook llegue dos veces, el pedido cuenta UN uso
  order_id         uuid not null unique references public.orders (id) on delete cascade,
  customer_email   text not null,
  discount_amount  numeric(12, 2) not null check (discount_amount >= 0),
  -- Se aprobó cuando el cupón ya no tenía usos (o ese email ya lo había
  -- usado): se respeta igual, porque el cliente ya pagó. Queda anotado.
  over_limit       boolean not null default false,
  created_at       timestamptz not null default now(),
  -- Pedido cancelado → el uso vuelve a estar disponible
  released_at      timestamptz
);

create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id) where released_at is null;
create index coupon_redemptions_email_idx on public.coupon_redemptions (coupon_id, customer_email) where released_at is null;

-- Intentos de aplicar un cupón (por visitante = hash de la IP, nunca la IP).
create table public.coupon_attempts (
  id          bigint generated always as identity primary key,
  key_hash    text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now()
);

create index coupon_attempts_key_idx on public.coupon_attempts (key_hash, created_at);
create index coupon_attempts_created_idx on public.coupon_attempts (created_at);

-- El pedido recuerda qué cupón usó (coupon_code ya existía: es la "foto" del código).
-- set null: si se borra un cupón que nunca se usó, un pedido sin pagar no lo bloquea.
alter table public.orders
  add column coupon_id uuid references public.coupons (id) on delete set null;

create index orders_coupon_id_idx on public.orders (coupon_id) where coupon_id is not null;

grant select (coupon_id) on public.orders to authenticated;

-- ---------------------------------------------------------------------
-- 2. Seguridad (RLS)
-- Solo los admins LEEN cupones y usos. Nadie escribe directo: todo pasa
-- por las funciones de abajo. Los intentos, solo el servidor.
-- ---------------------------------------------------------------------
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.coupon_attempts enable row level security;

revoke all on public.coupons from public, anon, authenticated;
revoke all on public.coupon_redemptions from public, anon, authenticated;
revoke all on public.coupon_attempts from public, anon, authenticated;

grant select on public.coupons to authenticated;
grant select on public.coupon_redemptions to authenticated;

grant all on public.coupons to service_role;
grant all on public.coupon_redemptions to service_role;
grant all on public.coupon_attempts to service_role;

create policy "Admins: ver los cupones"
  on public.coupons for select to authenticated
  using ((select public.is_admin()));

create policy "Admins: ver los usos de los cupones"
  on public.coupon_redemptions for select to authenticated
  using ((select public.is_admin()));

-- coupon_attempts: RLS activado y SIN policies → nadie salvo service_role.

-- ---------------------------------------------------------------------
-- 3. Vista del panel
-- security_invoker: pasa por el RLS de las tablas (a un no-admin no le
-- muestra nada).
-- ---------------------------------------------------------------------
create view public.admin_coupons
with (security_invoker = true)
as
select
  c.id, c.code, c.kind, c.value, c.starts_on, c.ends_on, c.max_uses,
  c.one_per_customer, c.min_purchase, c.is_active, c.created_at, c.updated_at,
  coalesce(r.uses, 0)::integer             as uses,
  coalesce(r.total_discount, 0)::numeric   as total_discount,
  coalesce(r.over_limit_uses, 0)::integer  as over_limit_uses,
  -- Alguna vez se usó (aunque después se cancelara): no se borra ni se cambia el código
  coalesce(r.all_redemptions, 0) > 0       as ever_used,
  (case
     when not c.is_active then 'paused'
     when c.ends_on is not null
          and c.ends_on < (now() at time zone 'America/Argentina/Buenos_Aires')::date then 'expired'
     when c.max_uses is not null and coalesce(r.uses, 0) >= c.max_uses then 'exhausted'
     when c.starts_on is not null
          and c.starts_on > (now() at time zone 'America/Argentina/Buenos_Aires')::date then 'scheduled'
     else 'active'
   end)::text                               as status
from public.coupons c
left join lateral (
  select count(*) filter (where cr.released_at is null)                     as uses,
         sum(cr.discount_amount) filter (where cr.released_at is null)      as total_discount,
         count(*) filter (where cr.released_at is null and cr.over_limit)   as over_limit_uses,
         count(*)                                                           as all_redemptions
    from public.coupon_redemptions cr
   where cr.coupon_id = c.id
) r on true;

revoke all on public.admin_coupons from public, anon, authenticated;
grant select on public.admin_coupons to authenticated;
grant select on public.admin_coupons to service_role;

-- ---------------------------------------------------------------------
-- 4. Ayudante: monto en formato argentino para las notas ("$ 12.345,50")
-- ---------------------------------------------------------------------
create or replace function public.format_ars(v numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select '$ ' || regexp_replace(
    translate(to_char(round(v, 2), 'FM999,999,999,990.00'), ',.', '.,'),
    ',00$', '');
$$;

revoke all on function public.format_ars(numeric) from public, anon, authenticated;
-- create_order (security invoker, corre como service_role) la usa para la nota del pedido
grant execute on function public.format_ars(numeric) to service_role;

-- ---------------------------------------------------------------------
-- 5. Panel: crear / editar, pausar y borrar
-- ---------------------------------------------------------------------
create or replace function public.save_coupon(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid := nullif(p ->> 'id', '')::uuid;
  v_code    text := upper(regexp_replace(coalesce(p ->> 'code', ''), '\s', '', 'g'));
  v_kind    public.coupon_kind;
  v_value   numeric(12, 2) := nullif(p ->> 'value', '')::numeric;
  v_starts  date := nullif(p ->> 'starts_on', '')::date;
  v_ends    date := nullif(p ->> 'ends_on', '')::date;
  v_max     integer := nullif(p ->> 'max_uses', '')::integer;
  v_min     numeric(12, 2) := nullif(p ->> 'min_purchase', '')::numeric;
  v_once    boolean := coalesce((p ->> 'one_per_customer')::boolean, false);
  v_active  boolean := coalesce((p ->> 'is_active')::boolean, true);
  v_old     public.coupons%rowtype;
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para cambiar cupones' using errcode = '42501';
  end if;

  begin
    v_kind := (p ->> 'kind')::public.coupon_kind;
  exception when others then
    v_kind := null;
  end;
  if v_kind is null then
    raise exception 'Elegí el tipo de cupón.' using errcode = 'HD422';
  end if;

  if v_code !~ '^[A-Z0-9-]{3,30}$' then
    raise exception 'El código va de 3 a 30 caracteres: letras, números o guiones, sin espacios.' using errcode = 'HD422';
  end if;
  if v_kind = 'percent' and (v_value is null or v_value < 1 or v_value > 100 or v_value <> round(v_value)) then
    raise exception 'El porcentaje tiene que ser un número entero entre 1 y 100.' using errcode = 'HD422';
  end if;
  if v_kind = 'fixed' and (v_value is null or v_value <= 0 or v_value > 99999999) then
    raise exception 'Escribí el monto del descuento.' using errcode = 'HD422';
  end if;
  if v_kind = 'free_shipping' then
    v_value := null;
  end if;
  if v_starts is not null and v_ends is not null and v_ends < v_starts then
    raise exception 'La fecha "hasta" no puede ser anterior a la fecha "desde".' using errcode = 'HD422';
  end if;
  if v_max is not null and v_max < 1 then
    raise exception 'Los usos máximos tienen que ser 1 o más (o dejalo vacío para que no tenga límite).' using errcode = 'HD422';
  end if;
  if v_min is not null and v_min <= 0 then
    raise exception 'La compra mínima tiene que ser mayor a $ 0 (o dejala vacía).' using errcode = 'HD422';
  end if;

  if exists (select 1 from public.coupons c where c.code = v_code and c.id is distinct from v_id) then
    raise exception 'Ya hay un cupón con el código %.', v_code using errcode = 'HD409';
  end if;

  -- ---- Nuevo -------------------------------------------------------------
  if v_id is null then
    insert into public.coupons (code, kind, value, starts_on, ends_on, max_uses,
                                one_per_customer, min_purchase, is_active)
    values (v_code, v_kind, v_value, v_starts, v_ends, v_max, v_once, v_min, v_active)
    returning id into v_id;
    return v_id;
  end if;

  -- ---- Editar ------------------------------------------------------------
  select * into v_old from public.coupons where id = v_id for update;
  if not found then
    raise exception 'El cupón no existe.' using errcode = 'HD404';
  end if;

  -- Si ya se usó, el código y el tipo quedan fijos (así el historial de
  -- los pedidos sigue teniendo sentido). Lo demás se puede cambiar y vale
  -- para las compras siguientes.
  if (v_old.code <> v_code or v_old.kind <> v_kind)
     and exists (select 1 from public.coupon_redemptions cr where cr.coupon_id = v_id) then
    raise exception 'Este cupón ya se usó: no se puede cambiar el código ni el tipo. Podés pausarlo y crear uno nuevo.'
      using errcode = 'HD409';
  end if;

  update public.coupons
     set code = v_code, kind = v_kind, value = v_value,
         starts_on = v_starts, ends_on = v_ends, max_uses = v_max,
         one_per_customer = v_once, min_purchase = v_min, is_active = v_active
   where id = v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'Ya hay un cupón con el código %.', v_code using errcode = 'HD409';
end;
$$;

revoke all on function public.save_coupon(jsonb) from public, anon;
grant execute on function public.save_coupon(jsonb) to authenticated;

create or replace function public.set_coupon_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para cambiar cupones' using errcode = '42501';
  end if;
  update public.coupons set is_active = coalesce(p_active, false) where id = p_id;
  if not found then
    raise exception 'El cupón no existe.' using errcode = 'HD404';
  end if;
end;
$$;

revoke all on function public.set_coupon_active(uuid, boolean) from public, anon;
grant execute on function public.set_coupon_active(uuid, boolean) to authenticated;

create or replace function public.delete_coupon(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para cambiar cupones' using errcode = '42501';
  end if;
  if exists (select 1 from public.coupon_redemptions cr where cr.coupon_id = p_id) then
    raise exception 'Este cupón ya se usó: podés pausarlo, pero no borrarlo.' using errcode = 'HD409';
  end if;
  delete from public.coupons where id = p_id;
  if not found then
    raise exception 'El cupón no existe.' using errcode = 'HD404';
  end if;
end;
$$;

revoke all on function public.delete_coupon(uuid) from public, anon;
grant execute on function public.delete_coupon(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. coupon_attempt(): límite de intentos del checkout
-- 10 por minuto por visitante (p_key = sha256 de la IP + clave del servidor).
-- Devuelve true si el intento está permitido (y lo registra).
-- ---------------------------------------------------------------------
create or replace function public.coupon_attempt(p_key text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  -- Dos intentos simultáneos del mismo visitante se cuentan de a uno
  perform pg_advisory_xact_lock(hashtext('coupon_attempt:' || p_key));

  -- Limpieza: lo de más de una hora ya no sirve
  delete from public.coupon_attempts where created_at < now() - interval '1 hour';

  select count(*) into v_count
    from public.coupon_attempts
   where key_hash = p_key and created_at > now() - interval '1 minute';

  if v_count >= 10 then
    return false;
  end if;

  insert into public.coupon_attempts (key_hash) values (p_key);
  return true;
end;
$$;

revoke all on function public.coupon_attempt(text) from public, anon, authenticated;
grant execute on function public.coupon_attempt(text) to service_role;

-- ---------------------------------------------------------------------
-- 7. coupon_quote(p jsonb): ¿vale el cupón y cuánto descuenta?
--
-- Recibe: coupon_code, customer_email (opcional), delivery_method e
-- items [{ variant_id, qty }]. No guarda nada.
-- Devuelve jsonb:
--   { ok: true,  coupon_id, code, kind, discount, subtotal, shipping, total }
--   { ok: false, error: 'no_existe' | 'pausado' | 'no_empezo' | 'vencido'
--                | 'agotado' | 'minimo' | 'ya_usado' | 'solo_envio'
--                | 'sin_efecto' | 'total_cero', + datos para el mensaje }
--
-- REGLA DEL MEJOR PRECIO (los descuentos no se suman nunca):
--   De cada producto la base sabe el precio de lista (price) y el precio
--   con el descuento del producto (final_price), de store_variants.
--   * Porcentaje: producto por producto. Precio con cupón = lista × (1 − p%).
--     El cliente paga el MENOR entre final_price y el precio con cupón. El
--     cupón aporta solo la diferencia (si el descuento del producto ya era
--     mejor, el cupón no suma nada en ese producto).
--   * Monto fijo F: se comparan dos opciones y gana la más barata:
--       A) productos en oferta con su descuento; el cupón se resta de los
--          productos SIN descuento (como mucho, lo que suman).
--       B) todo a precio de lista y el cupón se resta de todo.
--   * Envío gratis: descuenta el costo del envío (con retiro no aplica).
--   El descuento se guarda en discount_total; los precios de cada producto
--   del pedido siguen siendo los de la tienda (con su descuento propio).
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
    select w.qty, sv.price, sv.final_price
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
-- 8. create_order(): igual que en el paso 6 + cupón
-- Copia exacta de 20261130000001_cuenta_cliente.sql. Lo nuevo:
--   p ->> 'coupon_code' (opcional). Si viene, se valida con coupon_quote()
--   EN ESTE MOMENTO; si ya no vale → excepción 'cupon' con el motivo (jsonb)
--   en el detalle. El navegador nunca manda montos.
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
    subtotal, shipping_cost, discount_total, coupon_id, coupon_code, total
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
    v_subtotal, v_shipping, v_discount, v_coupon_id, v_coupon_code, v_total
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
-- 9. redeem_order_coupon(): cuenta el USO del cupón de un pedido
--
-- La llaman apply_order_payment (webhook, pago aprobado) y
-- resolve_review('approve'). Devuelve la nota para la línea de tiempo
-- (o null si el pedido no tiene cupón o el uso ya estaba contado).
--
-- Dos pagos aprobados a la vez con el ÚLTIMO uso: la fila del cupón se
-- bloquea ("for update"), así se atienden de a uno y el conteo es exacto.
-- Al segundo se le RESPETA el descuento (ya pagó) y queda over_limit = true.
-- ---------------------------------------------------------------------
create or replace function public.redeem_order_coupon(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o        public.orders%rowtype;
  c        public.coupons%rowtype;
  v_uses   integer;
  v_over   boolean := false;
begin
  if not (
    (select public.is_admin())
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or session_user = 'postgres'
  ) then
    raise exception 'No tenés permiso para cambiar pedidos' using errcode = '42501';
  end if;

  select * into o from public.orders where id = p_order_id;
  if not found or o.coupon_id is null then
    return null;
  end if;

  select * into c from public.coupons where id = o.coupon_id for update;
  if not found then
    return null;
  end if;

  -- Webhook repetido (o ya contado antes): no se cuenta otra vez
  if exists (select 1 from public.coupon_redemptions cr where cr.order_id = p_order_id) then
    return null;
  end if;

  select count(*) into v_uses
    from public.coupon_redemptions cr
   where cr.coupon_id = c.id and cr.released_at is null;

  v_over := (c.max_uses is not null and v_uses >= c.max_uses)
            or (c.one_per_customer and exists (
                  select 1 from public.coupon_redemptions cr
                   where cr.coupon_id = c.id and cr.released_at is null
                     and cr.customer_email = o.customer_email));

  insert into public.coupon_redemptions (coupon_id, order_id, customer_email, discount_amount, over_limit)
  values (c.id, p_order_id, o.customer_email, o.discount_total, v_over)
  on conflict (order_id) do nothing;

  return 'Cupón ' || coalesce(o.coupon_code, c.code) || ': −' || public.format_ars(o.discount_total)
         || case when v_over then ' (usado por encima del límite: se respetó porque el cliente ya había pagado)' else '' end;
end;
$$;

revoke all on function public.redeem_order_coupon(uuid) from public, anon, authenticated;
grant execute on function public.redeem_order_coupon(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 10. apply_order_payment(): igual que en el paso 5 + uso del cupón
-- Copia exacta de 20261128000002_gestion_pedidos.sql. Lo nuevo: al
-- aprobarse (y si el monto coincide), cuenta el uso del cupón.
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
  v_coupon  text;
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
    -- dueños. El stock (y el uso del cupón) no se tocan solos: vuelven al
    -- cancelar el pedido.
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

    -- Cupón: el uso se cuenta recién ahora (pago aprobado)
    v_coupon := public.redeem_order_coupon(p_order_id);

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
      nullif(concat_ws(' — ',
        case when v_issue then 'Pagado sin stock: cuando llegó el pago ya no alcanzaba el stock. No se descontó nada.' end,
        v_coupon), ''));

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
-- 11. cancel_order(): igual que en el paso 5 + el uso del cupón vuelve
-- Copia exacta de 20261128000002_gestion_pedidos.sql + released_at.
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
  v_freed   integer := 0;
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

  -- El uso del cupón vuelve a quedar disponible
  update public.coupon_redemptions
     set released_at = now()
   where order_id = p_order_id and released_at is null;
  get diagnostics v_freed = row_count;

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

  perform public.log_order_event(p_order_id, 'cancelled', o.fulfillment_status, 'cancelled',
    nullif(concat_ws(' — ', v_reason,
      case when v_freed > 0 then 'El uso del cupón ' || o.coupon_code || ' volvió a quedar disponible' end), ''));
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
-- 12. resolve_review(): igual que en el paso 5 + uso del cupón al aprobar
-- Copia exacta de 20261128000002_gestion_pedidos.sql.
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
