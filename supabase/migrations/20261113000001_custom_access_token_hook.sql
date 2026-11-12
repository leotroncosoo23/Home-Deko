-- =====================================================================
-- Migración: Custom Access Token Hook
-- ---------------------------------------------------------------------
-- Supabase llama a esta función cada vez que emite un token de sesión
-- (al iniciar sesión y al renovarlo, como máximo cada 1 hora).
-- Le agrega el claim "user_role" ('admin' o 'customer') leído de profiles.
--
-- Para qué: el proxy de Next (src/proxy.ts) puede saber si el usuario es
-- admin leyendo el token, SIN consultar la base en cada pedido.
--
-- Ojo: el rol del token puede tener hasta ~1 hora de atraso si se cambia.
-- Por eso los datos se siguen protegiendo con requireAdmin() (lee la base
-- en el momento) y con RLS. El token es solo para redirigir rápido.
--
-- DESPUÉS DE APLICARLA hay que activarla en el dashboard:
--   Authentication → Hooks → Customize Access Token (JWT) Claims
--   → elegir public.custom_access_token_hook
-- =====================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_claims jsonb;
  v_role   public.user_role;
begin
  select p.role into v_role
    from public.profiles p
   where p.id = (event ->> 'user_id')::uuid;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  -- Si por algún motivo no hay perfil, es 'customer' (nunca admin por defecto)
  v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(coalesce(v_role::text, 'customer')));

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos: SOLO el servicio de Auth de Supabase (rol supabase_auth_admin)
-- puede ejecutarla. Nadie desde la API.
-- ---------------------------------------------------------------------
grant usage on schema public to supabase_auth_admin;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;

-- La función corre como supabase_auth_admin, así que ese rol necesita
-- poder leer profiles (permiso + policy, porque profiles tiene RLS).
grant select on public.profiles to supabase_auth_admin;

create policy "Auth de Supabase: leer roles para el token"
  on public.profiles for select
  to supabase_auth_admin
  using (true);
