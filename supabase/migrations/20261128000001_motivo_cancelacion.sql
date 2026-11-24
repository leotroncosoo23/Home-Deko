-- =====================================================================
-- Migración: motivo de stock "cancelacion" (paso 5)
-- ---------------------------------------------------------------------
-- Cuando los dueños cancelan un pedido ya pagado, el stock vuelve con
-- adjust_stock(…, 'cancelacion'). Así en el historial de Stock se
-- distingue un pedido cancelado de una devolución de un cliente.
--
-- Va en un archivo aparte: Postgres no deja USAR un valor nuevo de un
-- enum en la misma transacción en la que se agrega.
-- =====================================================================

alter type public.stock_reason add value if not exists 'cancelacion';
