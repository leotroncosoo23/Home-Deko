-- =====================================================================
-- Migración: Barra de anuncios de la tienda
-- ---------------------------------------------------------------------
-- store_settings.announcement: el mensaje de la barra fina de arriba de
-- todo en la tienda. Se edita en Configuración. Vacío = la barra no se
-- muestra. Como el resto de store_settings, es de lectura pública: nunca
-- guardar nada secreto acá.
-- =====================================================================

alter table public.store_settings
  add column announcement text not null
    default 'Envíos a todo el país · Retiro gratis en Trevelin'
    check (char_length(announcement) <= 120);

-- Lectura pública y edición de admins, por columna (igual que las demás).
grant select (announcement) on public.store_settings to anon, authenticated;
grant update (announcement) on public.store_settings to authenticated;
