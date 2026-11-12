-- =====================================================================
-- Migración 5: Cerrar las funciones de trigger a la API
-- ---------------------------------------------------------------------
-- Postgres le da permiso de ejecutar cualquier función nueva a todos
-- (rol "public"). Eso hacía que estas funciones aparecieran en la API
-- (/rest/v1/rpc/...). No eran explotables (una función de trigger solo
-- puede correr como trigger), pero es más prolijo que no figuren.
-- Los triggers siguen funcionando igual: no necesitan este permiso.
-- =====================================================================

revoke execute on function public.handle_new_user()     from public, anon, authenticated;
revoke execute on function public.handle_user_updated() from public, anon, authenticated;
revoke execute on function public.sync_admin_email()    from public, anon, authenticated;
revoke execute on function public.set_variant_barcode() from public, anon, authenticated;
revoke execute on function public.protect_variant_barcode() from public, anon, authenticated;
revoke execute on function public.set_updated_at()      from public, anon, authenticated;
