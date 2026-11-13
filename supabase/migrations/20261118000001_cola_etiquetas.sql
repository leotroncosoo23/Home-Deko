-- =====================================================================
-- Migración: Cola de etiquetas (paso 9)
-- ---------------------------------------------------------------------
-- Una "cola de impresión" tipo carrito, COMPARTIDA por los admins: se
-- puede cargar desde el celular en el local e imprimir desde la PC.
--
--   1. Tabla label_queue: una fila por variante, con cuántas etiquetas.
--   2. Vista admin_label_queue: la cola con todo resuelto (producto,
--      variante, código, stock y foto), reusando admin_variant_stock.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. label_queue
--
-- variant_id es UNIQUE: una variante aparece una sola vez en la cola.
-- Al "agregar" de nuevo se REEMPLAZA la cantidad (no se suma), así no
-- se imprimen etiquetas de más sin querer.
-- on delete cascade: si se borra la variante, sale de la cola sola.
-- ---------------------------------------------------------------------
create table public.label_queue (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null unique references public.product_variants (id) on delete cascade,
  quantity    integer not null check (quantity between 1 and 999),
  added_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger label_queue_set_updated_at
  before update on public.label_queue
  for each row execute function public.set_updated_at();

-- Seguridad: solo admins (la tienda y los clientes no la ven nunca).
alter table public.label_queue enable row level security;

revoke all on public.label_queue from public, anon, authenticated;
grant select, insert, update, delete on public.label_queue to authenticated;
grant all on public.label_queue to service_role;

create policy "Admins: ver la cola de etiquetas"
  on public.label_queue for select to authenticated
  using ((select public.is_admin()));

create policy "Admins: agregar a la cola de etiquetas"
  on public.label_queue for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins: cambiar la cola de etiquetas"
  on public.label_queue for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins: quitar de la cola de etiquetas"
  on public.label_queue for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 2. admin_label_queue
--
-- join (no left join) con admin_variant_stock: las variantes desactivadas
-- o de productos archivados quedan afuera solas (no se imprimen).
-- Seguridad: security_invoker (aplica el RLS de quien consulta) y la
-- vista base ya filtra con is_admin().
-- ---------------------------------------------------------------------
create or replace view public.admin_label_queue
with (security_invoker = true)
as
select
  q.variant_id,
  q.quantity,
  q.created_at as queued_at,
  v.product_id,
  v.product_name,
  v.variant_label,
  v.sku,
  v.barcode,
  v.stock,
  v.image_path,
  v.position
from public.label_queue q
join public.admin_variant_stock v on v.variant_id = q.variant_id;

revoke all on public.admin_label_queue from public, anon, authenticated;
grant select on public.admin_label_queue to authenticated, service_role;
