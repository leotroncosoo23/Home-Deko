-- =====================================================================
-- Paso 9: páginas de información + Botón de arrepentimiento
-- ---------------------------------------------------------------------
-- 1. store_settings.dispatch_time: "Plazo de despacho" (texto libre, ej.
--    "24 a 48 h hábiles"). Público como el resto de la configuración.
-- 2. withdrawal_requests: solicitudes del Botón de arrepentimiento
--    (Disposición 954/2025: sin registración, con código de identificación).
--    Solo los admins las leen. Nadie escribe directo:
--      - TIENDA (solo service_role): create_withdrawal_request(p, key).
--      - PANEL (definer, is_admin() primero): set_withdrawal_status(...).
-- 3. withdrawal_attempts: límite de intentos por visitante (anti-spam).
-- 4. admin_home_attention(): suma pending_withdrawals (solicitudes nuevas).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Plazo de despacho
-- ---------------------------------------------------------------------
alter table public.store_settings
  add column dispatch_time text not null default ''
    check (char_length(dispatch_time) <= 60);

grant select (dispatch_time) on public.store_settings to anon, authenticated;
grant update (dispatch_time) on public.store_settings to authenticated;

-- ---------------------------------------------------------------------
-- 2. Solicitudes de arrepentimiento
-- ---------------------------------------------------------------------
create table public.withdrawal_requests (
  id                     uuid primary key default gen_random_uuid(),
  -- Código que ve el cliente (ARR-XXXXXX, sin letras que se confunden: I, O, 0, 1).
  code                   text not null unique check (code ~ '^ARR-[A-HJ-NP-Z2-9]{6}$'),
  full_name              text not null check (char_length(full_name) between 2 and 120),
  email                  text not null check (char_length(email) <= 254 and email like '%_@_%.__%'),
  order_number           bigint check (order_number is null or order_number > 0),
  -- Se completa solo si el número de pedido y el email coinciden con un pedido.
  order_id               uuid references public.orders (id) on delete set null,
  reason                 text check (reason is null or char_length(reason) <= 1000),
  status                 text not null default 'new'
                           check (status in ('new', 'in_progress', 'resolved', 'rejected')),
  admin_note             text check (admin_note is null or char_length(admin_note) <= 1000),
  handled_by             uuid references auth.users (id) on delete set null,
  handled_by_name        text,
  handled_at             timestamptz,
  customer_email_sent_at timestamptz,
  owners_email_sent_at   timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index withdrawal_requests_status_created_idx
  on public.withdrawal_requests (status, created_at desc);
create index withdrawal_requests_email_created_idx
  on public.withdrawal_requests (lower(email), created_at);
create index withdrawal_requests_order_id_idx
  on public.withdrawal_requests (order_id) where order_id is not null;

create trigger withdrawal_requests_set_updated_at
  before update on public.withdrawal_requests
  for each row execute function public.set_updated_at();

alter table public.withdrawal_requests enable row level security;
revoke all on public.withdrawal_requests from public, anon, authenticated;
grant select on public.withdrawal_requests to authenticated;
grant all on public.withdrawal_requests to service_role;

create policy "Admins: ver las solicitudes de arrepentimiento"
  on public.withdrawal_requests for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 3. Límite de intentos (como coupon_attempts): solo un HMAC de la IP.
--    RLS sin policies → solo service_role.
-- ---------------------------------------------------------------------
create table public.withdrawal_attempts (
  id         bigint generated always as identity primary key,
  key_hash   text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index withdrawal_attempts_key_created_idx on public.withdrawal_attempts (key_hash, created_at);
create index withdrawal_attempts_created_idx on public.withdrawal_attempts (created_at);

alter table public.withdrawal_attempts enable row level security;
revoke all on public.withdrawal_attempts from public, anon, authenticated;
grant all on public.withdrawal_attempts to service_role;

-- ---------------------------------------------------------------------
-- create_withdrawal_request: la llama SOLO el servidor de la tienda.
--   p = { full_name, email, order_number?, reason? }   p_key = HMAC de la IP
--   Devuelve { id, code }. Errores: HD429 (demasiados intentos), HD422 (datos).
-- ---------------------------------------------------------------------
create or replace function public.create_withdrawal_request(p jsonb, p_key text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name     text := trim(coalesce(p ->> 'full_name', ''));
  v_email    text := lower(trim(coalesce(p ->> 'email', '')));
  v_reason   text := nullif(trim(coalesce(p ->> 'reason', '')), '');
  v_number   bigint;
  v_order_id uuid;
  v_code     text;
  v_id       uuid;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_tries    integer := 0;
begin
  if p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    raise exception 'No pudimos registrar la solicitud.' using errcode = 'HD422';
  end if;

  -- Límite por visitante: 3 cada 10 minutos y 10 por día.
  perform pg_advisory_xact_lock(hashtext('withdrawal_attempt:' || p_key));
  delete from public.withdrawal_attempts wa where wa.created_at < now() - interval '1 day';
  if (select count(*) from public.withdrawal_attempts wa
       where wa.key_hash = p_key and wa.created_at > now() - interval '10 minutes') >= 3
     or (select count(*) from public.withdrawal_attempts wa
       where wa.key_hash = p_key) >= 10 then
    raise exception 'Recibimos varias solicitudes seguidas. Esperá unos minutos y volvé a intentar.'
      using errcode = 'HD429';
  end if;
  insert into public.withdrawal_attempts (key_hash) values (p_key);

  -- Validación (la misma que hace la app con zod; acá es la red de seguridad).
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Escribí tu nombre y apellido.' using errcode = 'HD422';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then
    raise exception 'Revisá el email.' using errcode = 'HD422';
  end if;
  if v_reason is not null and char_length(v_reason) > 1000 then
    raise exception 'El motivo puede tener hasta 1000 caracteres.' using errcode = 'HD422';
  end if;
  if coalesce(p ->> 'order_number', '') <> '' then
    if (p ->> 'order_number') !~ '^[0-9]{1,12}$' then
      raise exception 'El número de pedido tiene que tener solo números.' using errcode = 'HD422';
    end if;
    v_number := (p ->> 'order_number')::bigint;
  end if;

  -- Límite por email: 3 por día (aunque cambie de red).
  if (select count(*) from public.withdrawal_requests wr
       where lower(wr.email) = v_email and wr.created_at > now() - interval '1 day') >= 3 then
    raise exception 'Ya recibimos tus solicitudes de hoy. Si necesitás algo más, escribinos.'
      using errcode = 'HD429';
  end if;

  -- Vincular al pedido solo si número y email coinciden (no se le informa al cliente).
  if v_number is not null then
    select ord.id into v_order_id
      from public.orders ord
     where ord.order_number = v_number and ord.customer_email = v_email
     limit 1;
  end if;

  -- Código único: 32^6 ≈ mil millones de combinaciones; reintenta si choca.
  loop
    v_tries := v_tries + 1;
    v_code := 'ARR-';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::integer, 1);
    end loop;
    begin
      insert into public.withdrawal_requests (code, full_name, email, order_number, order_id, reason)
      values (v_code, v_name, v_email, v_number, v_order_id, v_reason)
      returning id into v_id;
      exit;
    exception when unique_violation then
      if v_tries >= 5 then raise; end if;
    end;
  end loop;

  return jsonb_build_object('id', v_id, 'code', v_code);
end;
$$;

revoke all on function public.create_withdrawal_request(jsonb, text) from public, anon, authenticated;
grant execute on function public.create_withdrawal_request(jsonb, text) to service_role;

-- ---------------------------------------------------------------------
-- set_withdrawal_status: panel. 'in_progress' | 'resolved' | 'rejected'.
-- Nunca vuelve a 'new'. "No corresponde" (rejected) exige una nota.
-- ---------------------------------------------------------------------
create or replace function public.set_withdrawal_status(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := auth.uid();
  v_name   text;
  v_note   text := nullif(trim(coalesce(p_note, '')), '');
  v_status text;
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para gestionar solicitudes' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('in_progress', 'resolved', 'rejected') then
    raise exception 'Elegí un estado válido.' using errcode = 'HD422';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'La nota puede tener hasta 1000 caracteres.' using errcode = 'HD422';
  end if;
  if p_status = 'rejected' and v_note is null then
    raise exception 'Contá en una nota por qué no corresponde (por ejemplo, fuera de plazo).' using errcode = 'HD422';
  end if;

  select wr.status into v_status from public.withdrawal_requests wr where wr.id = p_id for update;
  if not found then
    raise exception 'La solicitud no existe.' using errcode = 'HD404';
  end if;
  if v_status = p_status and v_note is null then
    raise exception 'La solicitud ya está en ese estado.' using errcode = 'HD409';
  end if;

  if v_actor is not null then
    select coalesce(nullif(trim(pr.full_name), ''), pr.email) into v_name
      from public.profiles pr where pr.id = v_actor;
  end if;

  update public.withdrawal_requests wr
     set status          = p_status,
         admin_note      = coalesce(v_note, wr.admin_note),
         handled_by      = v_actor,
         handled_by_name = v_name,
         handled_at      = now()
   where wr.id = p_id;
end;
$$;

revoke all on function public.set_withdrawal_status(uuid, text, text) from public, anon;
grant execute on function public.set_withdrawal_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. admin_home_attention(): cambia la tabla que devuelve → drop + create.
--    Mismo contrato que 20261202000002 + pending_withdrawals.
--    Columnas calificadas con alias (en plpgsql, las de salida son variables).
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
  left join public.store_settings cfg on true;
end;
$$;

revoke all on function public.admin_home_attention() from public, anon;
grant execute on function public.admin_home_attention() to authenticated;
