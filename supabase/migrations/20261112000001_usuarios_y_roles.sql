-- =====================================================================
-- Migración 1: Usuarios y roles
-- ---------------------------------------------------------------------
-- Crea:
--   * Los tipos (enums) que usa todo el proyecto.
--   * La función genérica set_updated_at() para los triggers de fechas.
--   * profiles      → un perfil por usuario de Supabase Auth, con su rol.
--   * admin_emails  → lista de emails que deben ser administradores.
--   * is_admin()    → función que usan todas las policies del panel.
--   * Triggers que asignan el rol automáticamente.
-- =====================================================================

grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Tipos (enums): listas cerradas de valores válidos.
-- Si alguien intenta guardar otro texto, la base lo rechaza.
-- ---------------------------------------------------------------------
create type public.user_role as enum ('admin', 'customer');
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.discount_type as enum ('percent', 'fixed');
create type public.stock_reason as enum (
  'inicial', 'ingreso', 'venta_web', 'venta_local', 'ajuste', 'rotura', 'devolucion'
);

-- ---------------------------------------------------------------------
-- set_updated_at(): antes de cada UPDATE pone updated_at = ahora.
-- Se reutiliza en todas las tablas que tienen updated_at.
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        public.user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- admin_emails: la lista de emails autorizados.
-- Se guardan siempre en minúsculas para comparar sin errores.
-- ---------------------------------------------------------------------
create table public.admin_emails (
  email       text primary key check (email = lower(trim(email))),
  note        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- is_admin(): ¿el usuario logueado es admin?
--
-- "security definer" = la función corre con los permisos de su dueño
-- (no del usuario que la llama). Así puede leer profiles sin chocar con
-- el RLS de profiles (si no, la policy se llamaría a sí misma en bucle).
--
-- "set search_path = ''" + nombres con esquema (public.profiles):
-- evita que alguien cree una tabla falsa con el mismo nombre y la engañe.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public;
-- anon también la necesita: las policies de la tienda la evalúan
-- (para un visitante siempre devuelve false).
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- compute_role(): decide el rol de un email.
--
-- IMPORTANTE (seguridad): solo da 'admin' si el email está CONFIRMADO.
-- Si no, cualquiera podría registrarse con email+contraseña usando el
-- email de un dueño (sin poder confirmarlo) y quedar como admin.
-- Con Google el email ya viene confirmado.
-- ---------------------------------------------------------------------
create or replace function public.compute_role(p_email text, p_confirmed_at timestamptz)
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_confirmed_at is not null
     and exists (select 1 from public.admin_emails a where a.email = lower(trim(p_email)))
    then 'admin'::public.user_role
    else 'customer'::public.user_role
  end;
$$;

revoke execute on function public.compute_role(text, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Trigger: cuando se crea un usuario en auth.users → crear su perfil.
-- Sirve igual para Google y para email/contraseña.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    -- Google manda el nombre como 'full_name' o 'name'
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    public.compute_role(new.email, new.email_confirmed_at)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Trigger: cuando el usuario confirma su email o lo cambia →
-- recalcular email y rol del perfil.
-- ---------------------------------------------------------------------
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email,
         role  = public.compute_role(new.email, new.email_confirmed_at)
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, email_confirmed_at on auth.users
  for each row execute function public.handle_user_updated();

-- ---------------------------------------------------------------------
-- Trigger: cuando se agrega o quita un email de admin_emails →
-- actualizar el rol de ese usuario si ya estaba registrado.
-- Así el segundo dueño puede registrarse antes o después: da igual.
-- ---------------------------------------------------------------------
create or replace function public.sync_admin_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := coalesce(new.email, old.email);
begin
  update public.profiles p
     set role = public.compute_role(u.email, u.email_confirmed_at)
    from auth.users u
   where u.id = p.id
     and lower(u.email) = v_email;
  return null; -- en triggers AFTER el valor devuelto se ignora
end;
$$;

create trigger admin_emails_sync
  after insert or delete on public.admin_emails
  for each row execute function public.sync_admin_email();

-- ---------------------------------------------------------------------
-- Datos iniciales: el primer administrador.
-- (El segundo dueño se agrega después con un insert igual a este.)
-- ---------------------------------------------------------------------
insert into public.admin_emails (email, note)
values ('troncosoleooficial@gmail.com', 'Leo');

-- =====================================================================
-- Seguridad (GRANT + RLS)
--
-- GRANT = "¿este rol puede tocar esta tabla/columna?" (la puerta).
-- RLS   = "¿qué filas puede ver o cambiar?" (la llave de cada depto).
--
-- Primero se revoca todo para arrancar de cero, por si existieran
-- permisos por defecto, y después se da solo lo necesario.
-- =====================================================================

-- profiles ------------------------------------------------------------
alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Solo puede editar su nombre. NO el rol (nadie puede auto-ascenderse).
grant update (full_name) on public.profiles to authenticated;
grant all on public.profiles to service_role;

create policy "Cada usuario ve su perfil; los admins ven todos"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Cada usuario edita su propio perfil"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- admin_emails --------------------------------------------------------
alter table public.admin_emails enable row level security;

revoke all on public.admin_emails from anon, authenticated;
grant select, insert, delete on public.admin_emails to authenticated;
grant all on public.admin_emails to service_role;

create policy "Admins: ver emails autorizados"
  on public.admin_emails for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins: agregar emails autorizados"
  on public.admin_emails for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admins: quitar emails autorizados"
  on public.admin_emails for delete
  to authenticated
  using ((select public.is_admin()));
