-- =====================================================================
-- Migración: cuenta del cliente (paso 6)
-- ---------------------------------------------------------------------
-- 1. profiles: datos que el CLIENTE guarda en "Mis datos" (teléfono y una
--    dirección de envío). Todos opcionales, con las mismas reglas que los
--    pedidos. Cada usuario edita SOLO su fila y SOLO estas columnas (el rol
--    nunca: sale de admin_emails).
-- 2. link_my_guest_orders(): al ingresar, suma a la cuenta las compras hechas
--    como invitado con el mismo email, SOLO si el email está verificado.
-- 3. create_order(): igual que en el paso 5, pero guarda customer_id (el
--    dueño del pedido para "Mis pedidos").
--
-- Eliminar la cuenta no necesita nada nuevo: al borrar el usuario de Auth,
-- profiles se borra en cascada y orders.customer_id / created_by,
-- order_events.actor_id, etc. quedan en null (on delete set null). Los
-- pedidos se conservan para la contabilidad, sin cuenta asociada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Datos del cliente en profiles
-- ---------------------------------------------------------------------
alter table public.profiles
  add column phone            text check (phone ~ '^[0-9]{8,15}$'),
  add column ship_address     text check (char_length(ship_address) between 1 and 200),
  add column ship_apartment   text check (char_length(ship_apartment) between 1 and 40),
  add column ship_city        text check (char_length(ship_city) between 1 and 100),
  add column ship_province    text check (char_length(ship_province) between 1 and 60),
  add column ship_postal_code text check (ship_postal_code ~ '^[A-Za-z]?[0-9]{4}[A-Za-z]{0,3}$'),
  add column ship_notes       text check (char_length(ship_notes) between 1 and 150);

-- El nombre también con un tope (hoy el más largo tiene 17 caracteres).
alter table public.profiles
  add constraint profiles_full_name_length check (char_length(full_name) <= 120);

-- Lectura: ya existe "select" para authenticated (y la policy deja ver solo
-- el propio perfil, o todos si es admin). Edición: solo estas columnas.
-- La policy "Cada usuario edita su propio perfil" ya limita a su fila.
grant update (
  full_name, phone,
  ship_address, ship_apartment, ship_city, ship_province, ship_postal_code, ship_notes
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 2. Sumar a la cuenta las compras hechas como invitado
-- ---------------------------------------------------------------------
-- Función de CLIENTE (no del panel): por eso en la primera línea exige una
-- sesión, en lugar de is_admin(). Solo toca pedidos SIN dueño y con el
-- mismo email de la cuenta, y solo si ese email está verificado (si no,
-- cualquiera podría crear una cuenta con un email ajeno y ver sus compras).
-- Se llama en cada ingreso: es idempotente (un pedido ya asociado no cambia).
create or replace function public.link_my_guest_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_confirmed timestamptz;
  v_count     integer;
begin
  if v_uid is null then
    raise exception 'Necesitás iniciar sesión' using errcode = '42501';
  end if;

  select lower(u.email), u.email_confirmed_at
    into v_email, v_confirmed
    from auth.users u
   where u.id = v_uid;

  if v_email is null or v_confirmed is null then
    return 0;
  end if;

  update public.orders o
     set customer_id = v_uid
   where o.customer_id is null
     and o.customer_email = v_email;  -- create_order ya lo guarda en minúsculas
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.link_my_guest_orders() from public, anon;
grant execute on function public.link_my_guest_orders() to authenticated;

-- Para que la búsqueda por email no recorra toda la tabla.
create index orders_guest_email_idx on public.orders (customer_email) where customer_id is null;

-- ---------------------------------------------------------------------
-- 3. create_order: ahora guarda customer_id
-- ---------------------------------------------------------------------
-- Copia exacta de la versión del paso 5 (20261129000001) + customer_id.
-- Sigue siendo SOLO para service_role: el servidor la llama con el id de la
-- sesión verificada; un navegador no la puede ejecutar.
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
    id, access_token_hash, delivery_method, created_by, customer_id,
    customer_name, customer_email, customer_phone,
    ship_address, ship_apartment, ship_city, ship_province, ship_postal_code, ship_notes,
    pickup_address, pickup_hours,
    subtotal, shipping_cost, discount_total, total
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
