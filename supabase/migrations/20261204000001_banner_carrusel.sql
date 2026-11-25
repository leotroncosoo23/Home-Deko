-- =====================================================================
-- Migración: banner principal en CARRUSEL (hasta 3 banners, con orden)
-- ---------------------------------------------------------------------
-- Antes: la tienda mostraba UN banner (el vigente que empezó más
-- recientemente). Ahora muestra TODOS los vigentes (hasta 3), en el orden
-- que se elige en el panel; con 2 o 3 pasan solos cada 6 segundos.
--
-- 1. banners.position (1..3, única): el orden del carrusel. Como hay como
--    máximo 3 posiciones y no se repiten, nunca puede haber más de 3
--    banners. Los que ya existen conservan todo y toman las posiciones en el
--    orden en que la tienda los priorizaba (hoy hay uno: queda como banner 1).
--    La unicidad es DEFERRABLE INITIALLY DEFERRED: se controla al final de
--    la transacción, así intercambiar o correr posiciones nunca choca a
--    mitad de camino.
-- 2. La posición la pone SIEMPRE la base (trigger antes de insertar): el
--    siguiente lugar libre. Con 3 banners → error HD409 con el texto para
--    mostrar.
-- 3. Al borrar un banner, los demás se corren para no dejar huecos.
-- 4. move_banner(id, -1 | 1): sube o baja un banner intercambiándolo con el
--    de al lado, todo junto.
--
-- Las tres operaciones toman el mismo candado de la transacción
-- (pg_advisory_xact_lock): dos cambios simultáneos se atienden de a uno y
-- nunca calculan el mismo lugar.
--
-- RLS: no cambia. Lectura pública solo de los activos y en fecha; escritura
-- solo con can_manage_appearance() (desarrollador, que ya exige is_admin()).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Orden
-- ---------------------------------------------------------------------
-- default 0: solo para que la app no tenga que mandarla; el trigger del
-- punto 2 la reemplaza SIEMPRE (0 no pasa el check).
alter table public.banners add column position smallint not null default 0;

-- Primero los que la tienda muestra HOY (activos y en fecha), y entre ellos
-- el orden en que la tienda los elegía hasta ahora. Así el banner que se ve
-- hoy queda como banner 1. Si hubiera más de 3, el check de abajo corta la
-- migración entera (no se pierde nada).
update public.banners b
   set position = s.rn
  from (
    select id,
           row_number() over (
             order by (is_active
                       and (starts_at is null or starts_at <= now())
                       and (ends_at is null or ends_at > now())) desc,
                      starts_at desc nulls last,
                      created_at desc
           ) as rn
      from public.banners
  ) s
 where b.id = s.id;

alter table public.banners
  add constraint banners_position_range check (position between 1 and 3),
  add constraint banners_position_unique unique (position) deferrable initially deferred;

comment on column public.banners.position is
  'Orden en el carrusel del inicio (1 a 3, sin repetir). La asigna la base al crear; se cambia con move_banner().';

-- ---------------------------------------------------------------------
-- 2. Lugar del banner nuevo
-- ---------------------------------------------------------------------
-- security definer: tiene que ver TODOS los banners para contar bien. No se
-- puede llamar directo (devuelve trigger); solo corre al insertar, y para
-- insertar ya hay que pasar el RLS (can_manage_appearance()).
create or replace function public.banners_assign_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('public.banners.position'));

  select count(*) into v_count from public.banners;
  if v_count >= 3 then
    raise exception 'Ya hay 3 banners, que es el máximo. Eliminá uno para agregar otro.'
      using errcode = 'HD409';
  end if;

  -- Las posiciones no tienen huecos (punto 3): el siguiente es count + 1.
  new.position := v_count + 1;
  return new;
end;
$$;

revoke execute on function public.banners_assign_position() from public, anon, authenticated, service_role;

create trigger banners_assign_position
  before insert on public.banners
  for each row execute function public.banners_assign_position();

-- ---------------------------------------------------------------------
-- 3. Sin huecos al borrar
-- ---------------------------------------------------------------------
create or replace function public.banners_compact_positions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.banners.position'));

  update public.banners b
     set position = s.rn
    from (select id, row_number() over (order by position) as rn from public.banners) s
   where b.id = s.id
     and b.position <> s.rn;
  return null;
end;
$$;

revoke execute on function public.banners_compact_positions() from public, anon, authenticated, service_role;

create trigger banners_compact_after_delete
  after delete on public.banners
  for each statement execute function public.banners_compact_positions();

-- ---------------------------------------------------------------------
-- 4. Subir / bajar
-- ---------------------------------------------------------------------
-- move_banner(id, -1) sube (hacia el banner 1); move_banner(id, 1) baja.
-- En el borde no hace nada.
create or replace function public.move_banner(p_id uuid, p_direction integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pos   smallint;
  v_other uuid;
begin
  if not (select public.can_manage_appearance()) then
    raise exception 'No tenés permiso para cambiar los banners' using errcode = '42501';
  end if;
  if p_direction is null or p_direction not in (-1, 1) then
    raise exception 'Dirección inválida' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.banners.position'));

  select position into v_pos from public.banners where id = p_id;
  if not found then
    raise exception 'Este banner ya no existe. Recargá la página.' using errcode = 'HD404';
  end if;

  select id into v_other from public.banners where position = v_pos + p_direction;
  if not found then
    return; -- ya está primero (o último)
  end if;

  update public.banners set position = v_pos + p_direction where id = p_id;
  update public.banners set position = v_pos where id = v_other;
end;
$$;

revoke execute on function public.move_banner(uuid, integer) from public, anon, service_role;
grant execute on function public.move_banner(uuid, integer) to authenticated;
