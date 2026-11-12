-- =====================================================================
-- Migración 4: Storage para las imágenes de productos
-- ---------------------------------------------------------------------
-- Bucket "product-images":
--   * Público: cualquiera puede VER las fotos por su URL (la tienda lo
--     necesita). Público no significa que cualquiera pueda subir.
--   * Solo admins pueden subir, reemplazar, borrar y listar archivos.
--   * Límite de 5 MB por archivo y solo JPG, PNG o WebP (igual las
--     imágenes se comprimen en el navegador antes de subir).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Admins: listar imágenes de productos"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

create policy "Admins: subir imágenes de productos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "Admins: reemplazar imágenes de productos"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "Admins: borrar imágenes de productos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
