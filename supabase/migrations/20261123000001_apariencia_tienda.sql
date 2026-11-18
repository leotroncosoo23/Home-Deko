-- =====================================================================
-- Migración: "Apariencia de la tienda" (barra de anuncios + Banner)
-- ---------------------------------------------------------------------
-- 1. can_manage_appearance(): reemplaza a can_manage_banners(). ÚNICO
--    lugar que decide quién usa la sección "Apariencia de la tienda"
--    (barra de anuncios y Banner). Hoy: solo el desarrollador.
--
--    ► Para habilitársela a los dueños: una migración que cambie el cuerpo
--      de can_manage_appearance() de is_developer() a is_admin().
--
-- 2. store_announcements: hasta 4 mensajes de la barra de anuncios, con
--    su orden. Tabla propia (y no una columna de store_settings) porque
--    store_settings la editan todos los admins, y esto es solo para quien
--    puede usar "Apariencia".
--    Se guardan todos juntos con save_store_announcements() (todo o nada).
--
-- 3. Se migra el mensaje que había en store_settings.announcement y se
--    borra esa columna.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Permiso de la sección
-- ---------------------------------------------------------------------
create or replace function public.can_manage_appearance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Hoy: solo el desarrollador. Para los dueños: cambiar por public.is_admin().
  select public.is_developer();
$$;

revoke execute on function public.can_manage_appearance() from public;
grant execute on function public.can_manage_appearance() to anon, authenticated, service_role;

-- Banners: las mismas policies, ahora con can_manage_appearance().
drop policy "Tienda: banners vigentes; sección Banner: todos" on public.banners;
drop policy "Sección Banner: crear banners" on public.banners;
drop policy "Sección Banner: editar banners" on public.banners;
drop policy "Sección Banner: borrar banners" on public.banners;

create policy "Tienda: banners vigentes; Apariencia: todos"
  on public.banners for select
  to anon, authenticated
  using (
    (
      is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    )
    or (select public.can_manage_appearance())
  );

create policy "Apariencia: crear banners"
  on public.banners for insert to authenticated
  with check ((select public.can_manage_appearance()));

create policy "Apariencia: editar banners"
  on public.banners for update to authenticated
  using ((select public.can_manage_appearance()))
  with check ((select public.can_manage_appearance()));

create policy "Apariencia: borrar banners"
  on public.banners for delete to authenticated
  using ((select public.can_manage_appearance()));

drop function public.can_manage_banners();

-- ---------------------------------------------------------------------
-- 2. store_announcements
-- ---------------------------------------------------------------------
create table public.store_announcements (
  id          uuid primary key default gen_random_uuid(),
  -- 1..4 y único: así nunca hay más de 4 mensajes.
  position    smallint not null unique check (position between 1 and 4),
  text        text not null check (length(trim(text)) > 0 and char_length(text) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger store_announcements_set_updated_at
  before update on public.store_announcements
  for each row execute function public.set_updated_at();

alter table public.store_announcements enable row level security;

revoke all on public.store_announcements from public, anon, authenticated;
grant select on public.store_announcements to anon, authenticated;
grant insert, update, delete on public.store_announcements to authenticated;
grant all on public.store_announcements to service_role;

create policy "Todos: leer los anuncios"
  on public.store_announcements for select
  to anon, authenticated
  using (true);

create policy "Apariencia: crear anuncios"
  on public.store_announcements for insert to authenticated
  with check ((select public.can_manage_appearance()));

create policy "Apariencia: editar anuncios"
  on public.store_announcements for update to authenticated
  using ((select public.can_manage_appearance()))
  with check ((select public.can_manage_appearance()));

create policy "Apariencia: borrar anuncios"
  on public.store_announcements for delete to authenticated
  using ((select public.can_manage_appearance()));

-- save_store_announcements(textos): reemplaza TODOS los mensajes por la
-- lista nueva, en ese orden (los vacíos se ignoran). Todo o nada.
-- security invoker: corre con los permisos de quien llama (aplica el RLS).
create or replace function public.save_store_announcements(p_texts text[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_texts text[];
begin
  if not (select public.can_manage_appearance()) then
    raise exception 'No tenés permiso para cambiar la barra de anuncios'
      using errcode = '42501';
  end if;

  -- Limpia espacios y saca los vacíos, conservando el orden.
  select coalesce(array_agg(t order by ord), '{}')
    into v_texts
    from (
      select regexp_replace(trim(x), '\s+', ' ', 'g') as t, ord
      from unnest(coalesce(p_texts, '{}')) with ordinality as u(x, ord)
    ) s
   where t <> '';

  if cardinality(v_texts) > 4 then
    raise exception 'Como máximo 4 mensajes' using errcode = '22023';
  end if;

  delete from public.store_announcements where true;
  insert into public.store_announcements (position, text)
  select ord, t from unnest(v_texts) with ordinality as u(t, ord);
end;
$$;

revoke execute on function public.save_store_announcements(text[]) from public, anon;
grant execute on function public.save_store_announcements(text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Migrar el mensaje actual y borrar la columna vieja
-- ---------------------------------------------------------------------
insert into public.store_announcements (position, text)
select 1, trim(announcement)
  from public.store_settings
 where trim(announcement) <> '';

alter table public.store_settings drop column announcement;
