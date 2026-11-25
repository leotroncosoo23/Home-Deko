-- =====================================================================
-- Medio de pago "getnet" en el enum payment_method.
--
-- Va SOLO en esta migración: Postgres no deja USAR un valor nuevo de un
-- enum en la misma transacción que lo agregó ("unsafe use of new value").
-- Así queda confirmado antes de 20261205000002_pagos_getnet.sql, cuya
-- create_order lo guarda en los pedidos de Getnet.
-- =====================================================================
alter type public.payment_method add value if not exists 'getnet';
