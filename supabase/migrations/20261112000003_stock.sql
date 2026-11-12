-- =====================================================================
-- Migración 3: Stock
-- ---------------------------------------------------------------------
-- Crea:
--   * stock_movements → historial de cada cambio de stock.
--                       Solo se agrega, nunca se edita ni se borra.
--   * adjust_stock()  → ÚNICA forma de cambiar el stock.
-- =====================================================================

create table public.stock_movements (
  id           uuid primary key default gen_random_uuid(),
  -- "restrict": no se puede borrar una variante que tiene historial.
  -- Para sacarla de circulación se usa product_variants.is_active = false.
  variant_id   uuid not null references public.product_variants (id) on delete restrict,
  quantity     integer not null check (quantity <> 0),  -- +5 entra, -2 sale
  reason       public.stock_reason not null,
  stock_after  integer not null check (stock_after >= 0), -- stock que quedó
  note         text,
  -- Pedido web (la FK se agrega cuando exista la tabla orders)
  order_id     uuid,
  -- Quién lo hizo. Queda vacío si lo hizo el servidor (ej. webhook).
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Para mostrar rápido el historial de una variante, del más nuevo al más viejo
create index stock_movements_variant_created_idx
  on public.stock_movements (variant_id, created_at desc);
create index stock_movements_order_id_idx
  on public.stock_movements (order_id) where order_id is not null;

-- ---------------------------------------------------------------------
-- adjust_stock(variante, cantidad, motivo, nota, pedido)
--
-- Todo pasa dentro de una sola transacción: si algo falla, no queda
-- nada a medias (ni stock cambiado sin movimiento, ni al revés).
--
-- Devuelve el stock nuevo.
--
-- Ejemplos:
--   select public.adjust_stock('<id>', 10, 'inicial');
--   select public.adjust_stock('<id>', -1, 'venta_local', 'Cliente del local');
-- ---------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_variant_id  uuid,
  p_quantity    integer,
  p_reason      public.stock_reason,
  p_note        text default null,
  p_order_id    uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock integer;
  v_new   integer;
begin
  -- 1) ¿Quién puede llamarla?
  --    * un admin logueado,
  --    * el servidor con la clave secreta (service_role), para el webhook
  --      de Mercado Pago más adelante,
  --    * o el usuario postgres desde el SQL Editor de Supabase (pruebas).
  if not (
    (select public.is_admin())
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or session_user = 'postgres'
  ) then
    raise exception 'No tenés permiso para ajustar stock'
      using errcode = '42501';
  end if;

  -- 2) La cantidad no puede ser cero
  if p_quantity is null or p_quantity = 0 then
    raise exception 'La cantidad no puede ser cero';
  end if;

  -- 3) Leer el stock actual y BLOQUEAR la fila ("for update").
  --    Si dos ventas llegan al mismo tiempo, la segunda espera a que
  --    termine la primera. Así nunca se pisan los números.
  select stock into v_stock
    from public.product_variants
   where id = p_variant_id
   for update;

  if not found then
    raise exception 'La variante no existe';
  end if;

  -- 4) Calcular el nuevo stock y no permitir negativos
  v_new := v_stock + p_quantity;
  if v_new < 0 then
    raise exception 'Stock insuficiente: hay % y se quieren descontar %',
      v_stock, abs(p_quantity);
  end if;

  -- 5) Guardar el stock nuevo
  update public.product_variants
     set stock = v_new
   where id = p_variant_id;

  -- 6) Registrar el movimiento en el historial
  insert into public.stock_movements
    (variant_id, quantity, reason, stock_after, note, order_id, created_by)
  values
    (p_variant_id, p_quantity, p_reason, v_new,
     nullif(trim(p_note), ''), p_order_id, auth.uid());

  -- 7) Devolver el stock nuevo
  return v_new;
end;
$$;

revoke execute on function public.adjust_stock(uuid, integer, public.stock_reason, text, uuid)
  from public, anon;
grant execute on function public.adjust_stock(uuid, integer, public.stock_reason, text, uuid)
  to authenticated, service_role;

-- =====================================================================
-- Seguridad
-- Los admins solo pueden LEER el historial. No hay grant de insert,
-- update ni delete: se escribe únicamente a través de adjust_stock(),
-- así el historial no se puede trucar.
-- =====================================================================
alter table public.stock_movements enable row level security;

revoke all on public.stock_movements from anon, authenticated;
grant select on public.stock_movements to authenticated;
grant all on public.stock_movements to service_role;

create policy "Admins: ver historial de stock"
  on public.stock_movements for select to authenticated
  using ((select public.is_admin()));
