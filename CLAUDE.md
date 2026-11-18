# Home-Deko — E-commerce + Panel de administración

## Contexto del proyecto
E-commerce para "Home Deko", un negocio de bazar y artículos para el hogar con local físico.
Los dueños son 2 personas (una pareja). Ambos son administradores con todos los permisos.
El objetivo es que todo sea **profesional, intuitivo y fácil de usar** para gente no técnica,
y que funcione muy bien en celular y en PC.

- Desarrollador: Leo (trabaja con Claude Code, una función por vez). Está aprendiendo:
  explicar las decisiones en simple y comentar el código en las partes no obvias.
- Idioma de toda la interfaz: **español (Argentina)**. Moneda: **ARS** (formato `$ 12.345,67`).
- Zona horaria: **America/Argentina/Buenos_Aires**.

## Estado y fechas
| Etapa | Fecha | Estado |
|---|---|---|
| Panel de productos, códigos de barras, etiquetas y stock | 16/11/2026 | ✅ Entregado. Los dueños ya cargan productos reales |
| Muestra de la tienda funcionando con sus productos | 27/11/2026 | ⏳ Próxima (2 rondas de ajustes) |
| Entrega final: tienda publicada, lista para las fiestas | 04/12/2026 | ⏳ |
| Garantía: corrección de errores sin costo | 30 días desde la entrega | |

## Stack
- **Next.js** (App Router, TypeScript, Server Components y Server Actions). En esta versión,
  el middleware se llama `proxy.ts` y `cacheComponents` está activado (lo que lee cookies va en `<Suspense>`).
- **Tailwind CSS** + **shadcn/ui** para todos los componentes de interfaz.
- **Supabase**: Postgres, Auth, Storage (imágenes) y RLS. Proyecto en **São Paulo (sa-east-1)**.
- **Vercel**: funciones en **gru1 (São Paulo)** vía `vercel.json`. Push a `main` = producción; otras ramas = preview.
- **Mercado Pago**: Checkout Pro + webhooks (etapa de la tienda).

## Estructura general
- Un solo proyecto Next.js:
  - Tienda pública en `/`
  - Panel de administración en `/admin` (protegido: solo administradores)
- La tienda y el panel leen y escriben **las mismas tablas**. Un solo stock para la web y el local.

## Variables de entorno
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` → **solo en el servidor**. Nunca en código de cliente ni con prefijo `NEXT_PUBLIC_`.
- Nunca leer, mostrar, copiar ni commitear el contenido de `.env.local`.

## Diseño e identidad visual
Marca: "Home Deko — Artículos del hogar". Logo en serif display de alto contraste, con un corazón rojo.
Concepto: "Tu casa, tu refugio, con diseño y calidez". Elegante pero accesible.
Versiones del logo: horizontal, apilada, negra sobre blanco y blanca sobre rojo. Archivos en `public/brand/`
(mientras no estén, el componente `logo.tsx` muestra el texto; se cambia solo ahí).
Versión `wordmark` ("Home ♥ Deko" sin la frase, `logo-horizontal-sin-frase-*.png`) para el encabezado y el pie de
la tienda: a ese tamaño "Artículos del hogar" quedaba ilegible (en el pie va como texto).

Paleta (variables CSS del tema de shadcn en `globals.css`):
- **Rojo Home Deko** `#C92728` (acento) · hover `#A81F20` · rojo suave `#FCEAEA`
- **Negro de marca** `#2B2B2B` (texto principal y botones primarios del panel)
- **Blanco** `#FFFFFF`
- Panel: fondo cálido `#EEEAE6`, bordes `#DDD6CF`, texto secundario `#6B645E`,
  tarjetas blancas con sombra suave (se eligió con este contraste para que se distinga en cualquier monitor)
- El rosa claro de la presentación de marca es solo el fondo de ese documento: no usarlo.

Tipografías:
- **Frunchy Sage** (display serif): solo títulos de la tienda y marca. Nunca en tablas ni formularios.
- **Gabriel Sans** (textos). Con `next/font/local` desde `public/fonts/` cuando estén los archivos y la licencia web.
  Mientras tanto: **Playfair Display** (display) e **Inter** (textos) con `next/font/google`.

### Panel (sobrio y profesional)
- Tarjetas con encabezado (`SectionCard`): ícono rojo en círculo rojo suave, título y frase corta.
- Etiqueta de grupo en rojo arriba del título de cada página (CATÁLOGO, INVENTARIO, VENTAS…).
- **Botones primarios en negro de marca**, nunca en rojo. El rojo es acento y "atención".
- Acciones destructivas: botón con borde + diálogo de confirmación.
- Estados: verde "Publicado" / stock OK · ámbar "Stock bajo" · gris "Borrador" / "Archivado" · rojo "Sin stock".
- Números tabulares en tablas, precios y stock.
- Desplegables dentro de tarjetas: usar portal (`FloatingPanel` o los de Base UI), porque `Card` tiene `overflow-hidden`.

### Tienda
- Más presencia del rojo: "Agregar al carrito" y "Comprar" en rojo de marca.
- Títulos en Frunchy Sage, cuerpo en Gabriel Sans. Mucho blanco y fotos grandes.
- Bloques o banners en rojo con el logo en blanco.
- **Pensada primero para celular.**

## Reglas de base de datos (obligatorias)
- Todo cambio de esquema con **migraciones de la Supabase CLI** (`supabase/migrations/`).
  Siempre **dry-run primero** (`npx supabase db push --remote --dry-run`), mostrarlo y esperar el OK
  antes del push real. Después del push, regenerar los tipos:
  `npx supabase gen types typescript --remote --schema public > src/lib/database.types.ts` (desde Git Bash).
- RLS automático activado y exposición automática de tablas desactivada. **Cada tabla nueva lleva**:
  `enable row level security`, sus `GRANT` y sus policies.
- `is_admin()` (security definer) en las policies del panel. Las funciones security definer
  validan `is_admin()` en la primera línea y usan `search_path` vacío.
- La tienda pública solo lee productos `active` y sus datos relacionados.
- `uuid` como clave primaria, `created_at` / `updated_at` con trigger.
- **Archivar, no borrar**: productos `draft | active | archived`. Solo se eliminan productos sin
  movimientos de stock además del "inicial" (`delete_product`).

## Usuarios y roles
- Entrada con **Google** y con email y contraseña. Crear una cuenta no da permisos: la seguridad está en el rol.
- Tabla `admin_emails`: un trigger asigna el rol `admin` en `profiles` si el email está en la lista y confirmado.
  Para sumar o sacar un admin, se edita `admin_emails` (nunca el rol a mano en `profiles`).
- El rol viaja en el token (Custom Access Token Hook) y lo lee `proxy.ts`. Cada consulta del panel pasa
  igual por `requireAdmin()`, y por debajo está el RLS.
- **Desarrollador**: `admin_emails.is_developer` marca a Leo (`troncosoleooficial@gmail.com`). Es admin con
  todo y además usa las **secciones reservadas**. Función `is_developer()` en la base.
- **Secciones reservadas** (hoy solo **Apariencia de la tienda** = barra de anuncios + Banner, solo para el
  desarrollador; los dueños le escriben a Leo para cambiarlos):
  - Quién la usa lo decide UNA función de la base: `can_manage_appearance()` (RLS de `banners` y
    `store_announcements` + la app vía `getPanelAccess()` en `src/lib/auth.ts`).
  - Servidor: páginas dentro de `AppearanceGate` / datos con `requireAppearanceAccess()` (sin permiso →
    `notFound()`); Server Actions con su propio chequeo. Menú: `feature: "appearance"` en `nav-items.ts`.
    Ayuda: `feature` en la guía.
  - **Para habilitársela a los dueños** (por ejemplo, si contratan "Fechas especiales"): una migración que
    cambie el cuerpo de `can_manage_appearance()` de `is_developer()` a `is_admin()`. No se toca la app:
    menú, páginas, acciones y ayuda aparecen solos. Actualizar también la pregunta frecuente
    "¿Cómo cambio el banner del inicio o los mensajes de la barra de arriba?" de `ayuda.ts`.
- `/login` es SOLO el ingreso del panel: nunca enlazarlo desde la tienda. "Ingresá" / "Mi cuenta" del encabezado
  lleva a `/mi-cuenta` (hoy un texto para clientes; en el paso 6, el ingreso de clientes). Con sesión de admin dice "Panel" → `/admin`.
- Hoy el login de los dueños está en `/login`. En la etapa de la tienda: login de admins en `/admin/login`
  y login de clientes en la tienda (ver más abajo).

## Productos (implementado)
- Producto: nombre, slug, descripción, categoría, precio base, estado, destacado, descuento opcional
  (porcentaje o monto fijo, con fechas opcionales).
- Opciones libres (Color, Medida u otras) con valores de texto libre; color con hex opcional.
- **Variantes**: cada combinación tiene su stock, stock mínimo, SKU, código de barras y precio opcional.
  Un producto sin variantes tiene una variante por defecto. Todo se guarda con `save_product` (todo o nada).
- Imágenes en el bucket `product-images`, comprimidas antes de subir, ordenables, con principal y color opcional.
- Precio de costo en tablas aparte, solo legibles por admins.
- Todas las variantes **controlan stock** (no hay opción para desactivarlo; se agrega solo si los dueños lo piden).

## Códigos de barras y etiquetas (implementado)
- EAN-13 con prefijo `200`, generado en la base (`barcode_seq` + `generate_ean13`). **Nunca cambia.**
- **El precio no va en la etiqueta** (decisión acordada con los dueños: así no reimprimen por aumentos).
- Cola de impresión compartida (`label_queue`), PDF A4 con `pdf-lib`, misma lógica de armado para la
  vista previa y el PDF (`src/lib/labels/`), grilla 4 × 10 por defecto, franja de título por fila,
  líneas de corte y "empezar en la posición X".

## Stock (implementado)
- El stock **nunca se edita a mano**: todo pasa por `adjust_stock` (atómica, nunca negativo, registra el movimiento).
- `stock_movements`: motivos `inicial`, `ingreso`, `venta_web`, `venta_local`, `ajuste`, `rotura`, `devolucion`.
- Corrección por conteo con `count_stock` (calcula la diferencia sobre el stock real del momento).
- Vistas `admin_products`, `admin_variant_stock`, `admin_stock_movements`, `admin_label_queue`.
- "Para reponer" y contador de stock bajo en el menú.

## Escaneo
- El buscador acepta texto y **lector USB** (escribe el código y Enter). Código exacto → abre el producto.
- El escáner con la cámara del celular **NO se implementa**: es parte del extra "App Home Deko".

## Ayuda dentro del panel (implementado)
- Sección "Ayuda" y botón "¿Cómo funciona?" en cada sección. Contenido en `src/content/ayuda.ts`.
- **Cuando se agregue o cambie una función del panel, actualizar también `ayuda.ts`.**

## Arquitectura del panel
Menú agrupado por tarea. Cada sección se suma al menú recién cuando está implementada.
- Inicio
- VENTAS: Pedidos (contador de pendientes)
- CATÁLOGO: Productos, Categorías
- INVENTARIO: Stock (contador de stock bajo), Etiquetas
- TIENDA ONLINE: Apariencia de la tienda (`/admin/apariencia`: barra de anuncios y Banner) — **solo desarrollador**
  (ver "Usuarios y roles")
- Abajo: Ayuda, Configuración y "Ver tienda"

## Inicio del panel (etapa de la tienda)
Todo sobre la TIENDA ONLINE (los ingresos del local son el futuro Módulo Local) + alertas de stock.

Período:
- Selector: Hoy, 7 días, 30 días, Este mes, Mes anterior, Este año y Personalizado (desde/hasta).
- Cada número muestra la variación vs. el período anterior ("▲ 12 % vs. mes pasado").

Esencial:
1. "Requiere atención" (arriba de todo): pedidos pagados sin preparar o sin código de seguimiento,
   productos sin stock y con stock bajo, cada uno con su botón de acción. Si no hay nada: "Todo en orden".
2. Tarjetas: ventas de la tienda ($), cantidad de pedidos y ticket promedio.
3. Gráfico de ventas: se agrupa solo según el período (día / semana / mes), con selector Día / Semana / Mes.
4. Más vendidos y últimos pedidos.

Recomendado (también para la entrega):
5. Visitas, tasa de conversión (visitas → compras) y de dónde vienen (Instagram, Google, WhatsApp, Facebook, directo).
6. Productos más vistos y "muy vistos pero poco vendidos".

Medición de visitas: contador propio y ANÓNIMO (sin datos personales), con el origen (referrer y UTM).
Tiene que medir desde el día del lanzamiento.

Estados vacíos: hasta que haya ventas o visitas, un mensaje claro
("Acá vas a ver las ventas cuando se lance la tienda"), nunca un gráfico en cero que parezca roto.

## Etapa actual: la tienda (prometido en la propuesta)
Se construye en pasos visibles. Cada paso: rama → probar en local → merge a `main` → los dueños lo ven.

### Configuración de la tienda (implementado)
- Tabla `store_settings` (**una sola fila**): `is_launched`, WhatsApp, Instagram, TikTok, costo de envío,
  dirección y horarios del local, plazo de cambios por gusto (`exchange_days`, 30 por defecto, 0 = no se
  aceptan), nombre o razón social, CUIT y email de contacto.
- Barra de anuncios: tabla `store_announcements` (hasta 4 mensajes de 120 caracteres, con orden), se guarda
  toda junta con `save_store_announcements()`. Se edita en "Apariencia de la tienda" (solo desarrollador).
  1 mensaje = fijo; 2 o más = cinta (marquee) que se pausa con hover/foco; con `prefers-reduced-motion`,
  rotación con fundido cada 4 s.
  Se edita en el panel: **Configuración** (`/admin/configuracion`).
- Lectura pública por columna (grant por columna + policy `using (true)`); solo admins editan; nadie
  inserta ni borra. **Nunca guardar secretos ahí** (tokens de Mercado Pago, etc.): todo es legible.
- Las páginas públicas la leen con `getStoreSettings()` (`src/lib/store-settings.ts`, `"use cache"` +
  `cacheTag("store-settings")`); las Server Actions llaman a `updateTag` al guardar.
- Los datos del comercio ya **no** van en `legales.ts`: `datosComercio()` los arma desde la config
  (vacíos → `[COMPLETAR]`). En `legales.ts` quedan fijos el nombre y el sitio. El arrepentimiento (10 días)
  y la garantía por falla van siempre en los Términos, sin importar `exchange_days` (son ley).

### Modo construcción (paso 0, implementado)
- `src/proxy.ts`: si `is_launched` es false, los visitantes ven "Muy pronto" en **cualquier** ruta de la
  tienda (rewrite a `/muy-pronto`, la URL no cambia; `/muy-pronto` directo redirige a `/`).
- Los **admins logueados** (rol del token) ven la tienda real (grupo `src/app/(tienda)/`) con la barra
  "Vista previa: la tienda todavía no está publicada".
- Se lanza con el interruptor "Tienda lanzada" en Configuración (pide confirmación).
- Las rutas de `src/lib/public-routes.ts` (`/privacidad`, `/terminos`, login) se ven siempre.
- Indexación sin lanzar: `/`, `/privacidad` y `/terminos` indexables (Google); el resto `noindex`
  (header `X-Robots-Tag` en el rewrite y metadata del layout de `(tienda)`).
- Requisitos de Google para verificar la marca, NO quitarlos (en "Muy pronto" **y** en el inicio real
  del paso 1): pública (nunca redirigir al login), `<title>` absoluto y `<h1>` "Home Deko", texto que
  explique qué es la tienda, cómo se compra y para qué sirve la cuenta con Google, y links a
  `/privacidad` y `/terminos` en el pie (`SiteFooter`).

### Páginas legales (adelantadas del paso 9)
- `/privacidad` y `/terminos` ya están hechas (grupo `src/app/(legal)/`), textos en `src/content/legales.ts`
  y datos del comercio desde Configuración. Lo que falta cargar se ve como `[COMPLETAR]` resaltado.

### Orden de los pasos
1. Inicio de la tienda: banner y productos destacados
2. Catálogo y categorías
3. Página de producto
4. Carrito y checkout (Mercado Pago en modo prueba)
5. Pedidos en el panel + emails
6. Cuenta del cliente y seguimiento
7. Cupones de descuento
8. Inicio del panel (ventas y visitas)
9. Páginas de información, legales y revisión final (muestra del 27/11)

### Inicio de la tienda
- **Banner principal** como plantilla de marca editable desde el panel (Apariencia de la tienda, hoy solo el desarrollador): título, texto, botón con link,
  foto de producto, fondo (rojo o blanco) y fechas de inicio y fin (se activa y se apaga solo).
  Opción de subir una imagen completa diseñada aparte.
- Productos destacados, botón "Ver todos los productos" y categorías.
- Menú hamburguesa con categorías e información (envíos, cómo comprar, contacto…).

### Catálogo y producto
- Catálogo por categorías, con buscador, filtros y orden. Cada color o medida con su propio stock.
- **Sin stock, sin venta**: una variante en 0 no se puede comprar.
- Fotos grandes; al elegir un color se muestran sus fotos.

### Carrito, checkout y envío
- Carrito y checkout con **Mercado Pago (Checkout Pro)**. El pedido se confirma **solo por el webhook**,
  consultando el pago a la API de Mercado Pago (nunca confiar en la redirección), y el stock se descuenta
  con `adjust_stock` (`venta_web`).
- El cliente elige la entrega:
  - **Envío a domicilio: $ 20.000** fijo, a cualquier zona del país, sin conexión con el Correo.
    El negocio despacha por Correo Argentino y carga el código de seguimiento.
  - **Retiro en el local: gratis**, mostrando dirección y horarios.
- **Total del pedido, calculado SIEMPRE en el servidor** (nunca confiar en lo que mande el navegador):
  productos − cupón + envío (envío = $ 0 si es retiro). El costo de envío se lee de `store_settings` en el
  momento del pago y **se guarda en el pedido** (igual que los precios de cada ítem), así cambiarlo después en
  Configuración no afecta los pedidos anteriores.
- **Compra como invitado** (nombre, email, teléfono, dirección si es envío) y **cuenta opcional**
  (Google en un clic) con "Mis pedidos" y el estado.

### Pedidos en el panel
- Envío: Pagado → Preparando → Enviado (con código de seguimiento) → Entregado.
- Retiro: Pagado → Preparando → Listo para retirar → Retirado.
- Cancelado en ambos casos (devuelve el stock con `adjust_stock`, motivo `devolucion`).
- Detalle de la compra, datos del cliente y tipo de entrega.
- Emails al cliente: confirmación de compra, "Enviado" con el seguimiento y "Listo para retirar".
  Con un servicio de email propio (por ejemplo Resend) y el dominio verificado: el SMTP gratis de
  Supabase no alcanza.

### Cupones
- Creados desde el panel: código, porcentaje o monto fijo, fechas, usos máximos y monto mínimo opcional.
- Regla de precios: si coinciden un descuento del producto y un cupón, aplicar el mejor precio para el
  cliente, sin sumar descuentos.

### Presencia en toda la tienda
- **Botón de WhatsApp flotante** en todas las páginas, con un mensaje ya escrito.
- Redes: **Instagram** (`homedeko.hogar`) y **TikTok**, en el pie de página y el menú.
- Pie de página con los datos del comercio (nombre o razón social, CUIT, dirección) y links a las páginas.

### Páginas de información y legales
Cómo comprar, Envíos y retiros, Cambios y devoluciones, Preguntas frecuentes, Contacto, Sobre nosotros,
Términos y condiciones, Política de privacidad y **Botón de arrepentimiento** (obligatorio en Argentina para
tiendas online). Los textos en un archivo de contenido (como `ayuda.ts`), fáciles de editar.

### Dominio
- Se construye y prueba con `homedeko.vercel.app`. Cuando esté el dominio final, actualizar: Vercel,
  Supabase (Site URL y Redirect URLs), Google (orígenes y marca), Mercado Pago (URL del webhook)
  y el servicio de emails (verificación del dominio).

### Ventas: preparado para el futuro Módulo Local
La tabla de pedidos/ventas tiene desde el inicio:
- canal: `web` | `local` (hoy solo `web`)
- medio de pago: `mercadopago` | `debito` | `credito` | `efectivo` | `transferencia`
- creado por (usuario o sistema)
Los reportes del Inicio se calculan sobre esta tabla, así después suman las ventas del local sin cambios.

## Extras futuros (NO implementar: se cotizan aparte)
- **Módulo Local**: venta rápida en el mostrador con escáner, caja diaria (apertura, cierre, arqueo),
  ventas por medio de pago, precio de lista y de contado (descuento por efectivo), empleados con permisos
  limitados (sin ver ingresos ni costos) y reportes del local.
- **App Home Deko**: PWA instalable, escáner con la cámara del celular, notificaciones.
- **Fechas especiales**: calendario de fechas comerciales, avisos en el Inicio, campañas con tema visual,
  descuentos y resumen de ventas. (Ojo: "Hot Sale" y "Cyber Monday" son marcas de la CACE.)
- Facturación electrónica con ARCA. Envío calculado (Correo Argentino). Carrito abandonado.
  Conteo de inventario. Control de stock activable. Catálogo en Instagram y Google. Reseñas.

## Forma de trabajo
- **Una función por vez**: plan primero (modo plan), implementar, probar en `localhost:3000`, commit.
- Ramas: `git checkout -b nombre-funcion` desde `main` actualizado; nunca trabajar directo en `main`.
- Cierre de cada rama (lo hace Leo): push → Pull Request y **Merge en GitHub** → `git checkout main` → `git pull`.
- Antes de crear algo grande, proponer el plan y los archivos a tocar.
- Correr `npx tsc --noEmit`, `npm run lint` y `npm run build` antes de cada commit.
- Todo texto visible en la tienda o en el panel es para los dueños o los clientes:
  nunca notas de desarrollo ('lo armamos en el próximo paso', 'TODO', 'placeholder').
  Si algo todavía no existe, usar un texto final y amable pensado para ellos.
  Las notas para Leo van en comentarios del código o en el chat, nunca en pantalla.

## Pruebas y datos reales
- La base es la de **producción**: los dueños ya cargan productos reales.
- Pruebas de SQL dentro de una transacción con rollback.
- Pruebas de punta a punta: solo datos con el prefijo "prueba-", y se borran al terminar.
- Nunca modificar ni borrar datos que no haya creado la prueba. Nunca reiniciar `barcode_seq`.
- Si una prueba necesita crear muchos datos o gasta códigos de barras, avisar antes.
