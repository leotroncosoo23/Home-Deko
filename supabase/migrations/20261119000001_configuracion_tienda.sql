-- =====================================================================
-- Migración: Configuración de la tienda (paso 0: modo construcción)
-- ---------------------------------------------------------------------
-- Una tabla con UNA SOLA FILA, editable desde el panel (Configuración):
--   - is_launched: el interruptor del modo construcción. Mientras está
--     en false, los visitantes ven la página "Muy pronto".
--   - Redes, envío, datos del local y del comercio (los usan la página
--     "Muy pronto", el pie de página y las páginas legales).
--
-- IMPORTANTE: todo lo que hay acá se puede leer desde la tienda pública.
-- NUNCA guardar en esta tabla datos secretos (tokens de Mercado Pago,
-- claves de servicios, etc.): esos van en variables de entorno.
-- =====================================================================

create table public.store_settings (
  id             uuid primary key default gen_random_uuid(),
  -- Garantiza una sola fila: solo puede valer true y es único.
  singleton      boolean not null default true unique check (singleton),

  is_launched    boolean not null default false,

  -- Redes y contacto
  whatsapp       text not null default '' check (whatsapp ~ '^([0-9]{10,15})?$'),
  instagram      text not null default 'homedeko.hogar' check (instagram ~ '^[A-Za-z0-9._]{0,30}$'),
  tiktok         text not null default '' check (tiktok ~ '^[A-Za-z0-9._]{0,24}$'),

  -- Envío y retiro
  shipping_cost  numeric(12, 2) not null default 20000 check (shipping_cost between 0 and 10000000),
  store_address  text not null default 'Av. San Martín 677, Trevelin, Chubut, Argentina'
                 check (char_length(store_address) <= 200),
  store_hours    text not null default '' check (char_length(store_hours) <= 300),

  -- Cambios por gusto (sin falla): plazo en días. 0 = no se aceptan.
  -- El arrepentimiento (10 días) y la garantía por falla no dependen de
  -- esto: son obligatorios por ley y están siempre en los Términos.
  exchange_days  integer not null default 30 check (exchange_days between 0 and 365),

  -- Datos del comercio (pie de página y páginas legales)
  business_name  text not null default '' check (char_length(business_name) <= 120),
  cuit           text not null default '' check (cuit ~ '^([0-9]{11})?$'),
  contact_email  text not null default ''
                 check (char_length(contact_email) <= 254 and (contact_email = '' or contact_email like '%_@_%')),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- La única fila, con los valores por defecto.
insert into public.store_settings default values;

-- ---------------------------------------------------------------------
-- Seguridad
--   - Lectura: cualquiera (la tienda la necesita), pero solo las columnas
--     que se muestran (grant por columna).
--   - Edición: solo admins, y solo los campos editables.
--   - Nadie puede insertar ni borrar: la fila es siempre la misma.
-- ---------------------------------------------------------------------
alter table public.store_settings enable row level security;

revoke all on public.store_settings from public, anon, authenticated;

grant select (
  id, is_launched, whatsapp, instagram, tiktok, shipping_cost,
  store_address, store_hours, exchange_days, business_name, cuit, contact_email
) on public.store_settings to anon, authenticated;

grant update (
  is_launched, whatsapp, instagram, tiktok, shipping_cost,
  store_address, store_hours, exchange_days, business_name, cuit, contact_email
) on public.store_settings to authenticated;

grant all on public.store_settings to service_role;

create policy "Todos: leer la configuración de la tienda"
  on public.store_settings for select to anon, authenticated
  using (true);

create policy "Admins: cambiar la configuración de la tienda"
  on public.store_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
