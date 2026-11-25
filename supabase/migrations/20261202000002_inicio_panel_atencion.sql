-- =====================================================================
-- Corrección: admin_home_attention() (paso 8)
-- ---------------------------------------------------------------------
-- En plpgsql, las columnas que devuelve la función (stock_issue,
-- needs_review…) son también variables. Como orders tiene columnas con el
-- mismo nombre, la consulta daba "column reference is ambiguous" (42702).
-- Solución: calificar cada columna con el alias de su tabla (ord., pv.).
-- Mismo contrato, permisos y reglas que en 20261202000001_inicio_panel.sql.
-- =====================================================================
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
    o.n_prepare, o.n_stock_issue, o.n_review,
    s.n_low, s.n_out,
    coalesce(cfg.contact_email = '', true),
    coalesce(cfg.whatsapp = '', true),
    coalesce(trim(cfg.business_name) = '', true),
    coalesce(cfg.cuit = '', true)
  from (
    select
      count(*) filter (where ord.payment_status = 'approved' and ord.fulfillment_status = 'paid') as n_prepare,
      count(*) filter (where ord.stock_issue and ord.fulfillment_status <> 'cancelled')          as n_stock_issue,
      count(*) filter (where ord.needs_review)                                                   as n_review
    from public.orders ord
  ) o
  cross join (
    select
      count(*) filter (where pv.stock > 0 and pv.stock <= pv.min_stock) as n_low,
      count(*) filter (where pv.stock = 0)                              as n_out
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.is_active and p.status <> 'archived'
  ) s
  left join public.store_settings cfg on true;
end;
$$;

revoke all on function public.admin_home_attention() from public, anon;
grant execute on function public.admin_home_attention() to authenticated;
