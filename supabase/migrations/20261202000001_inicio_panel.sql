-- =====================================================================
-- Migración: Inicio del panel (paso 8) — ventas y visitas de la tienda
-- ---------------------------------------------------------------------
--   1. Índice parcial de ventas por fecha de pago.
--   2. Contadores ANÓNIMOS de visitas (por día y origen) y de productos
--      vistos (por día y producto). Sin cookies, sin IP, sin navegador:
--      solo números por día, así no se puede reconstruir a ninguna persona.
--   3. track_visit() / track_product_view(): suman 1 (solo service_role,
--      las llama /api/visita).
--   4. admin_home_attention(): lo que "Requiere atención" (una consulta).
--   5. admin_dashboard(): tarjetas, gráfico, más vendidos y visitas de un
--      período, comparado con el anterior (una consulta, devuelve jsonb).
--
-- Qué es una VENTA (en todo el Inicio):
--   channel = 'web', payment_status = 'approved' y no cancelada.
--   "Pagado sin stock" cuenta (el pago está aprobado; si se devuelve el
--   dinero, se cancela y sale sola). El día es paid_at en hora de Argentina.
--   Monto = total cobrado (incluye el envío; se informa aparte).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Índice: las ventas de un rango de fechas, sin recorrer los pedidos
--    pendientes, vencidos ni cancelados.
-- ---------------------------------------------------------------------
create index if not exists orders_sales_paid_at_idx
  on public.orders (paid_at)
  where payment_status = 'approved' and fulfillment_status <> 'cancelled';

-- ---------------------------------------------------------------------
-- 2. Contadores de visitas
--
-- Excepción consciente a "uuid como clave primaria + created_at/updated_at":
-- son contadores agregados, la clave natural es (día, origen) / (día,
-- producto) y el "on conflict do update" necesita esa clave única.
-- ---------------------------------------------------------------------
create table public.visit_daily (
  day     date not null,
  source  text not null check (source in (
            'instagram', 'tiktok', 'facebook', 'google', 'whatsapp', 'otros', 'directo')),
  visits  integer not null default 0 check (visits >= 0),
  primary key (day, source)
);

comment on table public.visit_daily is
  'Visitas a la tienda por día (Argentina) y origen. Anónimo: solo contadores.';

create table public.product_view_daily (
  day         date not null,
  product_id  uuid not null references public.products (id) on delete cascade,
  views       integer not null default 0 check (views >= 0),
  primary key (day, product_id)
);

-- Para el borrado en cascada de un producto (la clave empieza por el día)
create index product_view_daily_product_id_idx on public.product_view_daily (product_id);

comment on table public.product_view_daily is
  'Vistas de cada producto por día (Argentina). Anónimo: solo contadores.';

-- Seguridad: solo los admins leen; nadie escribe directo (solo las
-- funciones de abajo, con service_role).
alter table public.visit_daily enable row level security;
alter table public.product_view_daily enable row level security;

revoke all on public.visit_daily from public, anon, authenticated;
revoke all on public.product_view_daily from public, anon, authenticated;

grant select on public.visit_daily to authenticated;
grant select on public.product_view_daily to authenticated;
grant select, insert, update on public.visit_daily to service_role;
grant select, insert, update on public.product_view_daily to service_role;

create policy "Admins: leer visitas"
  on public.visit_daily for select to authenticated
  using ((select public.is_admin()));

create policy "Admins: leer vistas de productos"
  on public.product_view_daily for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 3. Sumar una visita / una vista de producto
--
-- security invoker + solo service_role: las llama el servidor
-- (/api/visita), que ya descartó bots y admins y clasificó el origen.
-- Un origen desconocido o un producto que no está publicado → no hace nada
-- (nunca un error: el contador no tiene que molestar a nadie).
-- ---------------------------------------------------------------------
create or replace function public.track_visit(p_source text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_source is null or p_source not in (
    'instagram', 'tiktok', 'facebook', 'google', 'whatsapp', 'otros', 'directo'
  ) then
    return;
  end if;

  insert into public.visit_daily (day, source, visits)
  values ((now() at time zone 'America/Argentina/Buenos_Aires')::date, p_source, 1)
  on conflict (day, source) do update
    set visits = public.visit_daily.visits + 1;
end;
$$;

create or replace function public.track_product_view(p_product_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.product_view_daily (day, product_id, views)
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date, p.id, 1
    from public.products p
   where p.id = p_product_id
     and p.status = 'active'
  on conflict (day, product_id) do update
    set views = public.product_view_daily.views + 1;
end;
$$;

revoke all on function public.track_visit(text) from public, anon, authenticated;
revoke all on function public.track_product_view(uuid) from public, anon, authenticated;
grant execute on function public.track_visit(text) to service_role;
grant execute on function public.track_product_view(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 4. admin_home_attention(): "Requiere atención"
--
-- Mismas reglas que el resto del panel:
--   - to_prepare: pagados sin preparar (= pestaña "Para preparar")
--   - stock_issue / needs_review: = avisos de Pedidos
--   - low_stock / out_of_stock: variantes activas de productos no
--     archivados (= admin_variant_stock y el contador del menú)
--   - missing_*: datos del comercio vacíos en Configuración
-- ---------------------------------------------------------------------
create or replace function public.admin_home_attention()
returns table (
  to_prepare            bigint,
  stock_issue           bigint,
  needs_review          bigint,
  low_stock             bigint,
  out_of_stock          bigint,
  missing_email         boolean,
  missing_whatsapp      boolean,
  missing_business_name boolean,
  missing_cuit          boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para ver el inicio del panel' using errcode = '42501';
  end if;

  return query
  select
    o.to_prepare, o.stock_issue, o.needs_review,
    s.low_stock, s.out_of_stock,
    coalesce(cfg.contact_email = '', true),
    coalesce(cfg.whatsapp = '', true),
    coalesce(trim(cfg.business_name) = '', true),
    coalesce(cfg.cuit = '', true)
  from (
    select
      count(*) filter (where payment_status = 'approved' and fulfillment_status = 'paid') as to_prepare,
      count(*) filter (where stock_issue and fulfillment_status <> 'cancelled')          as stock_issue,
      count(*) filter (where needs_review)                                               as needs_review
    from public.orders
  ) o
  cross join (
    select
      count(*) filter (where pv.stock > 0 and pv.stock <= pv.min_stock) as low_stock,
      count(*) filter (where pv.stock = 0)                              as out_of_stock
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.is_active and p.status <> 'archived'
  ) s
  left join public.store_settings cfg on true;
end;
$$;

revoke all on function public.admin_home_attention() from public, anon;
grant execute on function public.admin_home_attention() to authenticated;

-- ---------------------------------------------------------------------
-- 5. admin_dashboard(): todo el Inicio de un período en una consulta
--
-- Parámetros: días de Argentina, inclusive. La app calcula el período
-- anterior (src/lib/dashboard-period.ts): así "Este mes" se compara con
-- los mismos días del mes pasado, "Hoy" con ayer, etc.
-- p_bucket: 'day' | 'week' (empieza el lunes) | 'month'.
--
-- Devuelve:
--   { launched,
--     current:  { sales, orders, shipping, discounts, visits },
--     previous: { … igual … },
--     series:   [ { start: 'YYYY-MM-DD', sales, orders } ]   (sin huecos)
--     top_products: [ { product_id, name, image_path, units, revenue } ]  (5)
--     sources:  [ { source, visits } ]                       (período actual)
--     top_viewed: [ { product_id, name, image_path, views, units } ] (5) }
--
-- Rápido con miles de pedidos: el rango se convierte a timestamptz una
-- vez y se busca por el índice parcial orders_sales_paid_at_idx.
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard(
  p_from      date,
  p_to        date,
  p_prev_from date,
  p_prev_to   date,
  p_bucket    text default 'day'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz     constant text := 'America/Argentina/Buenos_Aires';
  -- Bordes del período en instantes reales: 00:00 de Argentina del
  -- primer día y 00:00 del día siguiente al último.
  v_start  timestamptz;
  v_end    timestamptz;
  v_pstart timestamptz;
  v_pend   timestamptz;
  v_step   interval;
  v_result jsonb;
begin
  if not (select public.is_admin()) then
    raise exception 'No tenés permiso para ver el inicio del panel' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_prev_from is null or p_prev_to is null then
    raise exception 'Elegí las fechas del período.' using errcode = 'HD422';
  end if;
  if p_to < p_from or p_prev_to < p_prev_from then
    raise exception 'La fecha "hasta" no puede ser anterior a la fecha "desde".' using errcode = 'HD422';
  end if;
  if p_to - p_from > 731 or p_prev_to - p_prev_from > 731 then
    raise exception 'Elegí un período de hasta 2 años.' using errcode = 'HD422';
  end if;
  if p_bucket is null or p_bucket not in ('day', 'week', 'month') then
    raise exception 'Elegí cómo agrupar el gráfico: por día, semana o mes.' using errcode = 'HD422';
  end if;
  if p_bucket = 'day' and p_to - p_from > 92 then
    raise exception 'Para ver más de 3 meses, agrupá el gráfico por semana o por mes.' using errcode = 'HD422';
  end if;

  v_start  := p_from::timestamp at time zone v_tz;
  v_end    := (p_to + 1)::timestamp at time zone v_tz;
  v_pstart := p_prev_from::timestamp at time zone v_tz;
  v_pend   := (p_prev_to + 1)::timestamp at time zone v_tz;
  v_step   := case p_bucket when 'day' then interval '1 day'
                            when 'week' then interval '1 week'
                            else interval '1 month' end;

  with
  -- Ventas de los dos períodos juntos (una sola pasada por el índice)
  sales as (
    select o.id, o.total, o.shipping_cost, o.discount_total,
           (o.paid_at at time zone v_tz)::date as day,
           (o.paid_at >= v_start and o.paid_at < v_end) as is_current
      from public.orders o
     where o.payment_status = 'approved'
       and o.fulfillment_status <> 'cancelled'
       and o.channel = 'web'
       and ((o.paid_at >= v_start and o.paid_at < v_end)
         or (o.paid_at >= v_pstart and o.paid_at < v_pend))
  ),
  totals as (
    select
      jsonb_build_object(
        'sales',     coalesce(sum(total)          filter (where is_current), 0),
        'orders',    count(*)                     filter (where is_current),
        'shipping',  coalesce(sum(shipping_cost)  filter (where is_current), 0),
        'discounts', coalesce(sum(discount_total) filter (where is_current), 0),
        'visits',    (select coalesce(sum(v.visits), 0) from public.visit_daily v
                       where v.day between p_from and p_to)
      ) as cur,
      jsonb_build_object(
        'sales',     coalesce(sum(total)          filter (where not is_current), 0),
        'orders',    count(*)                     filter (where not is_current),
        'shipping',  coalesce(sum(shipping_cost)  filter (where not is_current), 0),
        'discounts', coalesce(sum(discount_total) filter (where not is_current), 0),
        'visits',    (select coalesce(sum(v.visits), 0) from public.visit_daily v
                       where v.day between p_prev_from and p_prev_to)
      ) as prev
    from sales
  ),
  -- Gráfico: todos los tramos del período, también los que no tienen ventas
  buckets as (
    select g::date as start
      from generate_series(
             date_trunc(p_bucket, p_from::timestamp),
             p_to::timestamp,
             v_step
           ) g
  ),
  bucket_sales as (
    select date_trunc(p_bucket, day::timestamp)::date as start,
           sum(total) as sales, count(*) as orders
      from sales
     where is_current
     group by 1
  ),
  -- Unidades y $ por producto en el período (para "más vendidos" y "más vistos")
  items as (
    select oi.product_id,
           min(oi.product_name) as snapshot_name,
           min(oi.image_path)   as snapshot_image,
           sum(oi.quantity)     as units,
           sum(oi.line_total)   as revenue
      from public.order_items oi
      join sales s on s.id = oi.order_id and s.is_current
     group by oi.product_id,
              -- Sin producto (se borró): se agrupa por el nombre guardado
              case when oi.product_id is null then oi.product_name end
  ),
  top_products as (
    select i.product_id,
           coalesce(p.name, i.snapshot_name) as name,
           coalesce(img.storage_path, i.snapshot_image) as image_path,
           i.units, i.revenue
      from items i
      left join public.products p on p.id = i.product_id
      left join lateral (
        select pi.storage_path from public.product_images pi
         where pi.product_id = i.product_id
         order by pi.is_primary desc, pi.position
         limit 1
      ) img on true
     order by i.units desc, i.revenue desc, name
     limit 5
  ),
  sources as (
    select v.source, sum(v.visits) as visits
      from public.visit_daily v
     where v.day between p_from and p_to
     group by v.source
  ),
  top_viewed as (
    select pv.product_id, p.name, img.storage_path as image_path,
           sum(pv.views) as views,
           coalesce((select i.units from items i where i.product_id = pv.product_id), 0) as units
      from public.product_view_daily pv
      join public.products p on p.id = pv.product_id
      left join lateral (
        select pi.storage_path from public.product_images pi
         where pi.product_id = pv.product_id
         order by pi.is_primary desc, pi.position
         limit 1
      ) img on true
     where pv.day between p_from and p_to
     group by pv.product_id, p.name, img.storage_path
     order by views desc, p.name
     limit 5
  )
  select jsonb_build_object(
    'launched', coalesce((select cfg.is_launched from public.store_settings cfg limit 1), false),
    'current',  t.cur,
    'previous', t.prev,
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'start',  to_char(b.start, 'YYYY-MM-DD'),
               'sales',  coalesce(bs.sales, 0),
               'orders', coalesce(bs.orders, 0)
             ) order by b.start), '[]'::jsonb)
        from buckets b
        left join bucket_sales bs on bs.start = b.start
    ),
    'top_products', (
      select coalesce(jsonb_agg(to_jsonb(tp) order by tp.units desc, tp.revenue desc, tp.name), '[]'::jsonb)
        from top_products tp
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', s.source, 'visits', s.visits)
                                order by s.visits desc, s.source), '[]'::jsonb)
        from sources s
    ),
    'top_viewed', (
      select coalesce(jsonb_agg(to_jsonb(tv) order by tv.views desc, tv.name), '[]'::jsonb)
        from top_viewed tv
    )
  )
  into v_result
  from totals t;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard(date, date, date, date, text) from public, anon;
grant execute on function public.admin_dashboard(date, date, date, date, text) to authenticated;
