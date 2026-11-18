-- =====================================================================
-- Migración: marca de DESARROLLADOR y sección Banner solo para él
-- ---------------------------------------------------------------------
-- 1. admin_emails.is_developer: marca a un admin como desarrollador
--    (Leo). Sigue siendo admin con todo; además puede usar las secciones
--    reservadas (hoy: Banner).
-- 2. is_developer(): ¿quien consulta es admin Y desarrollador?
-- 3. can_manage_banners(): ÚNICO lugar que decide quién usa la sección
--    Banner. Lo usan el RLS de banners y la app (rpc), así que cambiarlo
--    acá cambia todo (menú, páginas, acciones, ayuda).
--
--    ► Para habilitarles el Banner a los dueños (por ejemplo, si contratan
--      el módulo "Fechas especiales"): una migración nueva que cambie el
--      cuerpo de can_manage_banners() de is_developer() a is_admin().
--      No hace falta tocar la app.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columna nueva
-- ---------------------------------------------------------------------
alter table public.admin_emails
  add column is_developer boolean not null default false;

update public.admin_emails
   set is_developer = true
 where email = 'troncosoleooficial@gmail.com';

-- ---------------------------------------------------------------------
-- 2. is_developer()
--    Admin (rol en profiles, que ya exige email confirmado) + su email
--    marcado en admin_emails. Para un visitante devuelve false.
-- ---------------------------------------------------------------------
create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.admin_emails a on a.email = lower(trim(p.email))
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and a.is_developer
  );
$$;

revoke execute on function public.is_developer() from public;
grant execute on function public.is_developer() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. can_manage_banners()
-- ---------------------------------------------------------------------
create or replace function public.can_manage_banners()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Hoy: solo el desarrollador. Para los dueños: cambiar por public.is_admin().
  select public.is_developer();
$$;

revoke execute on function public.can_manage_banners() from public;
grant execute on function public.can_manage_banners() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Policies de banners: escribir y ver los NO vigentes → solo quien
--    puede usar la sección. La tienda sigue viendo el banner vigente.
-- ---------------------------------------------------------------------
drop policy "Tienda: banners vigentes; admins: todos" on public.banners;
drop policy "Admins: crear banners" on public.banners;
drop policy "Admins: editar banners" on public.banners;
drop policy "Admins: borrar banners" on public.banners;

create policy "Tienda: banners vigentes; sección Banner: todos"
  on public.banners for select
  to anon, authenticated
  using (
    (
      is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    )
    or (select public.can_manage_banners())
  );

create policy "Sección Banner: crear banners"
  on public.banners for insert to authenticated
  with check ((select public.can_manage_banners()));

create policy "Sección Banner: editar banners"
  on public.banners for update to authenticated
  using ((select public.can_manage_banners()))
  with check ((select public.can_manage_banners()));

create policy "Sección Banner: borrar banners"
  on public.banners for delete to authenticated
  using ((select public.can_manage_banners()));
