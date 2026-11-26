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
- **Pagos**: **Getnet Web Checkout** (por defecto) o **Mercado Pago** Checkout Pro, según `PAYMENT_PROVIDER`.
  Ver "Pagos con Getnet" más abajo.

## Estructura general
- Un solo proyecto Next.js:
  - Tienda pública en `/`
  - Panel de administración en `/admin` (protegido: solo administradores)
- La tienda y el panel leen y escriben **las mismas tablas**. Un solo stock para la web y el local.

## Variables de entorno
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` → **solo en el servidor**. Nunca en código de cliente ni con prefijo `NEXT_PUBLIC_`.
  Se usa solo desde `src/lib/supabase/admin.ts` (`createAdminClient`).
- `NEXT_PUBLIC_SITE_URL` → URL pública (back_urls y webhook de Mercado Pago, metadata). En local: `http://localhost:3000`.
  **Producción: `https://www.homedekotrevelin.com` (con www)**: la versión sin www redirige y Mercado Pago puede no
  seguir el redirect (webhook y regreso del pago).
- `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` → solo servidor (`src/lib/mercadopago.ts`). Hoy, de PRUEBA.
- `ORDER_LINK_SECRET` → solo servidor (`src/lib/order-token.ts`). Clave para derivar el link secreto de cada pedido
  (`/pedido/{id}?t=…`). **Obligatoria para el checkout** (sin ella, "No pudimos iniciar el pago" y la consola dice cuál
  falta). Generarla una vez (`openssl rand -base64 32`) y **no cambiarla nunca**: invalidaría los links de todos los pedidos.
- `RESEND_API_KEY` y `EMAIL_FROM` (`Home Deko <pedidos@homedekotrevelin.com>`) → solo servidor (`src/lib/email/send.ts`).
  Opcionales: si faltan, la tienda funciona igual, no se manda ningún mail y la consola avisa (`[email] … sin configurar`).
- `MERCADOPAGO_NOTIFICATION_URL_BASE` → **opcional, solo para probar en local**: URL del túnel (cloudflared) para que el
  webhook llegue a la compu mientras se navega en localhost. En producción no se define (y si estuviera, se ignora:
  `notificationBaseUrl()` en `src/lib/site-url.ts`).
- `PAYMENT_PROVIDER` → `getnet` (por defecto, si no está) | `mercadopago`. Elige el medio de pago del checkout.
- `GETNET_CLIENT_ID`, `GETNET_CLIENT_SECRET`, `GETNET_ENV` (`sandbox` | `production`), `GETNET_WEBHOOK_USER`,
  `GETNET_WEBHOOK_PASSWORD` → solo servidor (`src/lib/payments/`). Si falta alguna, el checkout muestra "Los pagos
  online no están disponibles…" con WhatsApp y no crea pedidos.
- Plantilla sin valores: `.env.example` (sí se versiona).
- Nunca leer, mostrar, copiar ni commitear el contenido de `.env.local`.

## Pagos con Getnet (implementado, falta cargar credenciales)
- Config en UN lugar: `src/lib/payments/config.ts` (hosts por ambiente, paths, textos por proveedor). Cliente:
  `src/lib/payments/getnet.ts` (token OAuth cacheado en memoria, payment intent en modo redirect, Basic auth del
  webhook en tiempo constante). Lo dudoso de la doc oficial está marcado **"A CONFIRMAR"** en el código.
- Flujo: `create_order` (con `payment_provider`, DNI y facturación) → intent (monto en centavos, `order_id` =
  `HD-<número>`, vence a las 2 h) → página segura de Getnet → vuelve a `/pedido/[id]`.
- Webhook `/api/getnet/webhook` → `apply_order_payment(..., p_provider => 'getnet', p_mismatch)`: controla
  referencia, monto y moneda; un rechazo no es final (si después llega aprobado, se aprueba); idempotente.
- Red de seguridad: "Revisar pago en Getnet" en el inicio (intent de 2 h a 72 h sin aviso), botón "Verificar pago"
  en el pedido (muestra el intent_id: la doc no publica consulta de estado) y tarjeta "Estado de Getnet" en
  Configuración (solo desarrollador, "Probar conexión" solo pide un token).
- DNI y `billing_*`: sin grant para `authenticated`, fuera de logs y mails; se borran al eliminar la cuenta
  (`forget_order_personal_data`). Mercado Pago sigue entero (`src/lib/mercadopago.ts`), apagado.
- Tests: `npm test` (Vitest, respuestas de Getnet simuladas). En Git Bash, entrar a la carpeta como `/C/...`.

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
  Excepción: funciones de CLIENTE (hoy solo `link_my_guest_orders()`) validan `auth.uid()` en la primera línea
  y solo tocan filas del propio usuario.
- La tienda pública solo lee productos `active` y sus datos relacionados.
- `uuid` como clave primaria, `created_at` / `updated_at` con trigger.
- **Archivar, no borrar**: productos `draft | active | archived`. Solo se eliminan productos sin
  movimientos de stock además del "inicial" (`delete_product`).

## Usuarios y roles
- **Dos puertas, un solo sistema de sesiones**: admins en `/admin/login` (**solo Google**: no hay formulario de
  contraseña ni "crear cuenta"; las Server Actions de contraseña se borraron) y clientes
  en `/mi-cuenta` (Google o código de 6 dígitos por email, sin contraseñas). La puerta no da permisos: crear una
  cuenta (por cualquiera de las dos) nace con rol `customer`; la seguridad está en el rol.
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
- `/admin/login` es SOLO el ingreso del panel: nunca enlazarlo desde la tienda. Vive fuera del grupo
  `src/app/admin/(panel)/` (que tiene el layout con el menú); el proxy lo deja pasar sin sesión y redirige el
  `/login` viejo hacia ahí (con `?next=`). Cliente que entra a `/admin` → `/sin-acceso`.
- "Ingresá" / "Mi cuenta" del encabezado lleva a `/mi-cuenta`. Con sesión de cliente muestra su primer nombre
  (PC) o "Mi cuenta"; con sesión de admin dice "Panel" → `/admin`.

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
- `stock_movements`: motivos `inicial`, `ingreso`, `venta_web`, `venta_local`, `ajuste`, `rotura`, `devolucion`,
  `cancelacion` (pedido cancelado en el panel; no se elige a mano).
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
- VENTAS: Pedidos (contador de los que requieren atención; gestión completa en el paso 5), Cupones (paso 7),
  Arrepentimientos (paso 9, contador de solicitudes nuevas)
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

### Inicio del panel (paso 8, implementado)
- Migraciones `20261202000001_inicio_panel.sql` + `20261202000002_inicio_panel_atencion.sql` (corrige un nombre de
  columna ambiguo en plpgsql: en funciones `returns table`, calificar SIEMPRE las columnas con el alias de su tabla).
- **Venta** (en todo el Inicio): `channel = 'web'`, `payment_status = 'approved'`, no cancelada. "Pagado sin stock"
  cuenta. Día = `paid_at` en hora de Argentina. Monto = `total` (con envío; la tarjeta dice "incluye $ X de envíos").
  Índice parcial `orders_sales_paid_at_idx`.
- `admin_home_attention()` (definer, `is_admin()`): para preparar, pagados sin stock, para revisar, variantes con stock
  bajo / sin stock (misma regla que `admin_variant_stock`) y datos vacíos de Configuración (email, WhatsApp, razón
  social, CUIT). Mismos números que Pedidos y Stock. Sin nada: "Todo al día".
- `admin_dashboard(desde, hasta, desde_ant, hasta_ant, 'day'|'week'|'month')` (definer, `is_admin()`, un `jsonb`):
  tarjetas de los dos períodos, serie sin huecos (`generate_series`; la semana empieza el lunes), 5 más vendidos (un
  producto borrado se agrupa por el nombre guardado), orígenes y 5 más vistos con unidades vendidas. `HD422` si
  hasta < desde, > 2 años o > 92 días agrupado por día.
- Períodos en `src/lib/dashboard-period.ts` (puro; la URL: `?periodo=&agrupar=&desde=&hasta=`; por defecto 30 días).
  La app decide el período anterior: Hoy → ayer; 7/30 días → los anteriores; Este mes → mismos días del mes pasado;
  Mes anterior → el previo; Este año → mismo tramo del año pasado; Personalizado → mismo largo justo antes.
  Agrupación automática: día ≤ 31 días, semana ≤ 120, mes después. Un solo día: sin gráfico (mensaje).
- Pantalla (`src/app/admin/(panel)/page.tsx` + `_inicio/`): Requiere atención en su propio `<Suspense>`, selector
  (links + `next/form` para Personalizado), tarjetas, gráfico de barras **HTML/CSS armado en el servidor** (sin
  librería; tooltip con CSS, tabla `sr-only`), más vendidos, últimos 5 pedidos ("Todos") y visitas.
- **Visitas: contador propio, anónimo y SIN cookies** (se descartó Vercel Web Analytics: los datos quedan en Vercel y
  no se pueden cruzar con las ventas en el panel). Tablas `visit_daily (day, source)` y `product_view_daily (day,
  product_id)`: solo contadores por día, nada de la persona. Solo admins leen; escriben `track_visit(source)` y
  `track_product_view(product_id)` (invoker, solo `service_role`; origen desconocido o producto no `active` → nada).
  - Navegador: `VisitTracker` (layout de `(tienda)`) y `ProductViewTracker` (página de producto), en
    `src/components/store/visit-tracker.tsx`. Una visita por sesión (marca en `sessionStorage` `hd_visita`, sin
    identificador), una vista por producto y sesión. Manda solo el DOMINIO del referrer y `utm_source`, con
    `sendBeacon` cuando el navegador está libre (no afecta la carga).
  - Servidor: `POST /api/visita` (fuera del `matcher` del proxy). Descarta otro Origin / `Sec-Fetch-Site`, bots por
    user-agent y sesiones admin (`user_role` del token; solo si hay cookie `sb-`). Siempre 204; la suma va en `after()`.
  - Origen: `src/lib/visit-source.ts` (utm primero; después el dominio, también `android-app://`). WhatsApp casi
    nunca manda referrer → "Directo" salvo `?utm_source=whatsapp` (explicado en la Ayuda).
  - Los números son orientativos: alguien podría inflarlos a propósito (no hay límite por IP para no guardar IPs).
- Conversión = pedidos ÷ visitas. "Mucho interés, pocas ventas": ≥ 20 vistas y menos de 1 venta cada 20.
- Ayuda: guía `inicio` (id especial: su ruta es `/admin`) y 3 preguntas frecuentes. Privacidad: "sin cookies".

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
- También `dispatch_time` (plazo de despacho, paso 9).
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
  del paso 1): pública (nunca redirigir al login), `<title>` absoluto y `<h1>` "Home Deko" (en el inicio, solo
  para lectores de pantalla), texto visible que nombre a "Home Deko" y explique qué es la tienda, cómo se compra y
  para qué sirve la cuenta con Google ("Cómo comprar" corto del inicio), y links a
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
8. Inicio del panel (ventas y visitas) — implementado (ver "Inicio del panel (paso 8, implementado)")
9. Páginas de información, legales y revisión final (muestra del 27/11) — páginas y Botón de arrepentimiento
   implementados (ver "Páginas de información + Botón de arrepentimiento")

### Inicio de la tienda
- **Banner principal** como plantilla de marca editable desde el panel (Apariencia de la tienda, hoy solo el desarrollador): título, texto, botón con link,
  foto de producto, fondo (rojo o blanco) y fechas de inicio y fin (se activa y se apaga solo).
  Opción de subir una imagen completa diseñada aparte (PC 1920 × 800, celular 1080 × 1350 opcional).
- **Carrusel (implementado)**: hasta **3 banners** (`banners.position` 1..3, única `deferrable initially deferred`;
  migración `20261204000001_banner_carrusel.sql`). La posición la pone SIEMPRE la base (trigger
  `banners_assign_position`: siguiente lugar; con 3 → `HD409` con el texto para mostrar); al borrar, los demás se
  corren (trigger por sentencia); subir/bajar con `move_banner(id, -1|1)` (definer, `can_manage_appearance()`
  primero, solo `authenticated`). Las tres toman el mismo `pg_advisory_xact_lock`.
  - Tienda: `getActiveBanners()` (vigentes por `position`) → `HeroBanners`: 0 = el de Home Deko, 1 = fijo como
    siempre, 2–3 = `HeroCarousel` (`src/components/store/hero-carousel.tsx`, CSS scroll-snap sin librerías): pasa
    cada 6 s, flechas en PC, swipe, puntitos, botón de pausa; se pausa con mouse, toque y foco de teclado; con
    `prefers-reduced-motion` no pasa solo. Alto fijo por CSS (12:5 en PC; 4:5 en celular salvo que ninguna
    diapositiva tenga formato de celular). Solo la 1ª imagen con prioridad. Las que no se ven son `inert`.
  - Panel: lista en el orden del carrusel con ↑ ↓; "Nuevo banner" desaparece con 3.
- **Orden del inicio (rama `home-ventas`)**: banner → barra de beneficios → Novedades → Categorías → Ofertas → Más
  vendidos → "Estamos en Trevelin" + "Cómo comprar" corto → pie. Componentes en `src/components/store/home/`.
  - Tiras (`ProductStrip`, la misma `ProductCard` del catálogo): celular = fila que se desliza (2 y un pedacito),
    PC = 4 con flechas si hay más. Solo productos **con stock**, hasta 8; una tira vacía no se muestra. Iguales para
    todos (también admins: sin borradores), todo en caché.
  - Datos en `store-data.ts`: `getNewArrivals`, `getOnSaleProducts`, `getBestSellersStrip`. Más vendidos = unidades
    de pedidos `approved` no cancelados (lee `order_items` con `createAdminClient`; solo salen ids). **Con menos de 4
    vendidos, la tira se titula "Destacados"** y muestra los `is_featured` (`src/lib/best-sellers.ts`, con tests).
  - "Ver todos": Novedades → `/productos?orden=nuevos`; Ofertas → `/productos?ofertas=1` (filtro `ofertas` de
    `catalog-params.ts`, título "Ofertas" y chip para quitarlo); Más vendidos/Destacados → `/productos`.
  - Categorías: `CategoryShowcase` con la "Foto de portada" (`categories.image_path`, se sube en el panel);
    sin foto = fondo cálido con el corazón. Celular carrusel, PC grilla de 2/3.
  - Google: `<h1>` "Home Deko – Bazar, blanquería y deco en Trevelin" solo para lectores (`sr-only`) y
    `HowToBuyCompact` (store-highlights.tsx) con "Home Deko" escrito en el texto visible. No quitarlos.
  - La barra de beneficios no muestra cuotas: las cuotas se harán aparte con Getnet.
- Menú hamburguesa con categorías e información (envíos, cómo comprar, contacto…).

### Catálogo y producto
- Catálogo por categorías, con buscador, filtros y orden. Cada color o medida con su propio stock.
- **Sin stock, sin venta**: una variante en 0 no se puede comprar. En los listados, los sin stock van siempre al final.
- **Categoría oculta → sus productos no se ven en la tienda** (catálogo, búsqueda, inicio y página de producto).
  Lo resuelve la vista `store_products`: toda lectura pública de productos pasa por ahí. Sin categoría = se ve.
- Catálogo (paso 2, implementado): `/productos`, `/categorias/[slug]` y `/buscar?q=` comparten `CatalogView`
  (`src/components/store/catalog/`). Estado en la URL (`?orden=&min=&max=&pagina=`, + `q` y `categoria` en
  `/buscar`), parseado en `src/lib/catalog-params.ts`. 24 por tanda; "Ver más" es un link a `?pagina=N`.
  Búsqueda sobre `store_products.search_text` (nombre + categoría + códigos de barras, sin tildes).
- Tarjeta de producto (`product-card.tsx`): descuento como "-10% OFF" (redondeado) o "Hasta -20% OFF" si las variantes
  ahorran distinto (`discount_percent_max/min` de la vista); "¡Últimas unidades!" si quedan 1 o 2 en total
  (`few_left`, un sí/no: la tienda nunca muestra el número de unidades). Lo que cambie el stock (también las
  ventas web del paso 4) tiene que llamar a `updateTag(STORE_PRODUCTS_TAG)` para que la etiqueta se actualice.
- Fotos grandes; al elegir un color se muestran sus fotos.
- Página de producto (paso 3, implementado): `/productos/[slug]` (`src/components/store/product/`). Busca primero en
  `store_products` (borrador solo para admins; archivado o categoría oculta → 404). Galería (deslizar en celular,
  miniaturas + lupa en PC, pantalla completa), opciones en orden (un valor sin stock con lo ya elegido: tachado y
  deshabilitado), cantidad con tope `stock − lo que ya está en el carrito`, envío/retiro de Configuración, WhatsApp
  con el producto, "Productos relacionados" y JSON-LD `Product`.
- **Precio por variante: vista `store_variants`** (`final_price` con el descuento vigente, misma regla que
  `store_products`). Es la única fuente de precios de la tienda: página de producto, carrito y checkout.

### Carrito, checkout y envío
- **Botón rápido en la tarjeta de producto** (`ProductCard`: inicio, catálogo, categorías y búsqueda):
  - Producto con **una sola variante**: "Agregar" lo suma al carrito, con el aviso "Agregado ✓".
  - Con **varias variantes**: "Ver opciones" lleva a la página del producto.
  - **Sin stock**: sin botón.
  - Botón con texto en todos los tamaños, debajo del precio (no tapa la foto).
- **Precios para clientes sin ",00"**: `formatPrice` (tienda, carrito, checkout, pedido y mails); el panel sigue con
  `formatARS`. "Precio sin impuestos nacionales" opcional en Configuración (`store_settings.show_price_without_taxes`
  y `national_tax_percent`), en la página del producto.
- **Carrito (paso 3, implementado)** — `src/components/store/cart/`:
  - El navegador guarda SOLO `{ variantId, qty }` en localStorage (`hd_carrito`). Nombre, foto, precio y stock
    los arma siempre el servidor con `getCartLines` (`src/app/(tienda)/actions.ts`, lee `store_variants`), que
    además ajusta: sin stock / despublicado → se saca con aviso; bajó el stock → se baja la cantidad.
  - `CartProvider` (en `StoreFrame`): un solo panel y un solo aviso para toda la tienda. Al agregar: botón
    "Agregado ✓", la foto vuela al ícono (`data-cart-target`), rebote y el número sube, aviso de 3 s bajo el
    carrito (región `role="status"` para lectores de pantalla). Con `prefers-reduced-motion`: solo el aviso.
  - "Iniciar compra" lleva a `/finalizar-compra` (checkout del paso 4).
- Carrito y checkout con **Mercado Pago (Checkout Pro)**. El pedido se confirma **solo por el webhook**,
  consultando el pago a la API de Mercado Pago (nunca confiar en la redirección), y el stock se descuenta
  con `adjust_stock` (`venta_web`).

### Checkout y pedidos (paso 4, implementado)
- `/finalizar-compra` (`src/components/store/checkout/`): datos (nombre, email, teléfono), entrega (envío con
  calle y número, piso/depto opcional (`ship_apartment`, 40), ciudad/provincia/CP e indicaciones opcionales
  (`ship_notes`, 150; se ven en el rótulo, el detalle, los mails y la lista de preparación) o retiro), resumen y aceptar Términos. zod compartido en `src/lib/checkout-schema.ts`.
  Datos del cliente recordados en `localStorage` (`hd_datos_compra`).
- Server Action `startCheckout` (`finalizar-compra/actions.ts`): `create_order` → preferencia de MP con lo
  **guardado en el pedido** → `init_point`. API REST directa (sin SDK) en `src/lib/mercadopago.ts`.
- Preferencia: `external_reference` = id del pedido · `back_urls` a `/pedido/{id}?t={token}` + `auto_return` **solo con
  https**: MP rechaza `localhost`/`127.0.0.1` en `back_urls`. En local se omiten y el cliente vuelve con "Ver el estado de
  mi último pedido" en `/finalizar-compra` (link guardado antes de ir a MP) · `notification_url` = `notificationBaseUrl()`
  + `/api/mercadopago/webhook`, también solo si es https (si no, vale la URL del panel de Webhooks) · **vence a las 2 h**
  · **sin efectivo** (ticket/atm excluidos: quedan pendientes días).
  **Con credenciales de PRUEBA no se manda `payer.email`**: si el email del formulario es de una cuenta real de MP, el
  pago falla con "Una de las partes con la que intentás hacer el pago es de prueba"; sin email, el comprador de prueba
  se identifica en MP. En producción sí se manda. Lo decide `isTestCredentials()` (`src/lib/mercadopago.ts`): token
  `TEST-…`, o cuenta con la marca `test_user` según `/users/me` (las credenciales de un vendedor de prueba empiezan con
  `APP_USR-` como las reales); se averigua una vez por arranque del servidor y en desarrollo se ve en la consola
  (`[checkout] Mercado Pago en modo PRUEBA`). El email del cliente se guarda igual en el pedido.
  Si MP rechaza la preferencia, la consola del
  servidor muestra `[mercadopago] preferencia rechazada: status … — mensaje | causas` (nunca token ni headers).
- Tablas `orders` (también es la tabla de VENTAS: `channel`, `payment_method`, `created_by`) y `order_items` (foto de
  nombre, variante, imagen y precio). Estados: `payment_status` (pending/approved/rejected/cancelled) y
  `fulfillment_status` (awaiting_payment → paid → preparing → shipped/delivered o ready_for_pickup/picked_up; cancelled).
  `discount_total` + `coupon_code` (+ `coupon_id`) los llena el paso 7 (ver "Cupones"). Número amable `order_number` desde 1001.
- RLS: admins leen todo, clientes solo lo suyo (`customer_id`, paso 6). **Nadie escribe salvo el servidor** con
  service_role. `create_order(jsonb)` y `apply_order_payment(...)` son `security invoker`, solo `service_role`.
- `create_order`: precios de `store_variants` (exige producto `active`: con service_role no hay RLS), envío y datos del
  local de `store_settings`, verifica stock (errores `sin_stock` / `no_disponible`). No descuenta.
- Webhook `src/app/api/mercadopago/webhook/route.ts`: firma `x-signature` (HMAC, `timingSafeEqual`) → `getPayment` →
  `apply_order_payment` → `revalidateTag(STORE_PRODUCTS_TAG, { expire: 0 })` (en Route Handlers no hay `updateTag`).
  Formato IPN viejo (`topic`/`id`) → 200 sin procesar; en el panel de MP se activa **solo Webhooks**.
  `/api/mercadopago` está en `ALWAYS_PUBLIC_PATHS` (si no, el modo construcción lo reescribe a "Muy pronto").
- `apply_order_payment` (idempotente, `for update`): control de monto con `transaction_amount` (sin intereses de
  cuotas) y `currency_id = ARS`; si no coincide → `needs_review` + `review_reason`, sin aprobar ni descontar. Un aviso
  viejo de otro intento no baja un pedido aprobado; un reembolso del mismo pago → cancelado + `needs_review` (el stock
  no se toca solo: devolverlo es el paso 5).
- **Última unidad (decisión: opción A)**: se revisa el stock al crear el pedido y al aprobarse se descuenta todo o nada
  (variantes bloqueadas en orden de id). Si ya no alcanza → `stock_issue` = **"Pagado sin stock"** en el panel: los
  dueños devuelven el dinero desde MP u ofrecen otro producto. Sin reservas ni reembolso automático.
- `/pedido/[id]?t=token`: link secreto para invitados. Desde el paso 5 el token se **deriva** del id
  (HMAC-SHA256 con `ORDER_LINK_SECRET`, 43 caracteres): el servidor lo puede rearmar para los mails y el WhatsApp
  (`customerOrderUrl()`). El id lo genera `startCheckout` y viaja en `create_order` (`p ->> 'id'`). En la base solo el
  sha256 en `access_token_hash`, que ni los admins leen por la API. Token incorrecto → 404. Estados: aprobado (vacía el carrito una vez por pedido),
  confirmando (se actualiza cada 5 s ~1 min), en revisión, rechazado/cancelado/vencido ("Volver a intentar").
  `referrer: no-referrer`. El último link queda en `localStorage` (`hd_ultimo_pedido`).
- Panel `/admin/pedidos` (grupo VENTAS): ver "Pedidos en el panel (paso 5, implementado)". Contador del menú =
  pagados para preparar + para revisar.
- **Pruebas en local**: navegar en `localhost:3000` (sesión de admin) y solo el webhook por túnel:
  `cloudflared tunnel --url http://localhost:3000` → su URL en `MERCADOPAGO_NOTIFICATION_URL_BASE` y en el panel de
  Webhooks de MP (modo prueba). Las pruebas de SQL de pedidos consumen números de `order_number` (no vuelven atrás):
  antes del lanzamiento, si no hay pedidos reales, se puede reiniciar a 1001.
- El cliente elige la entrega:
  - **Envío a domicilio: $ 20.000** fijo, a cualquier zona del país, sin conexión con ningún transporte.
    El negocio despacha y carga el código de seguimiento. **Transporte todavía sin definir**: no nombrar
    ninguna empresa (Correo Argentino u otra) en la tienda ni en los legales hasta que los dueños lo confirmen.
  - **Retiro en el local: gratis**, mostrando dirección y horarios.
- **Total del pedido, calculado SIEMPRE en el servidor** (nunca confiar en lo que mande el navegador):
  productos − cupón + envío (envío = $ 0 si es retiro). El costo de envío se lee de `store_settings` en el
  momento del pago y **se guarda en el pedido** (igual que los precios de cada ítem), así cambiarlo después en
  Configuración no afecta los pedidos anteriores.
- **Compra como invitado** (nombre, email, teléfono, dirección si es envío) y **cuenta opcional**
  (Google en un clic) con "Mis pedidos" y el estado.
- **Paso 6 (cuenta del cliente): al iniciar sesión, el carrito del navegador NO se pierde.** Se conserva tal
  cual; si la cuenta llegara a guardar un carrito propio, se combinan (sumando cantidades, con el tope del stock).
  Hoy la cuenta NO guarda carrito: vive solo en `hd_carrito` y entrar/salir no lo toca.

### Cuenta del cliente (paso 6, implementado)
- `/mi-cuenta` (`src/app/(tienda)/mi-cuenta/`, componentes en `src/components/store/account/`). Sin sesión:
  ingreso con Google (`GoogleSignInButton` con `onSignedIn`) o con código por email (`sendLoginCode` →
  `signInWithOtp`, `verifyLoginCode` → `verifyOtp` tipo `email`). Si no existe la cuenta, se crea sola.
  `?volver=` validado con `safeReturnPath()` (solo rutas de la tienda). Con sesión: Mis pedidos, Mis datos,
  Cerrar sesión (→ `/`) y Eliminar mi cuenta.
- **Mails de los códigos**: los manda Supabase Auth por el **SMTP de Resend** (configurado en el panel de
  Supabase: `smtp.resend.com:465`, usuario `resend`, clave propia "Supabase Auth"). Plantillas "Magic Link" y
  "Confirm signup" con `{{ .Token }}`. Código de 6 dígitos, vence a los 600 s. El límite de Resend (100/día en el
  plan gratis) lo comparten con los mails de pedidos.
- Datos de la cuenta: columnas en `profiles` (`phone`, `ship_address`, `ship_apartment`, `ship_city`,
  `ship_province`, `ship_postal_code`, `ship_notes`). `authenticated` solo tiene UPDATE por columna de esas +
  `full_name` (nunca `role`). Validación compartida: `src/lib/account-schema.ts` (reusa las reglas de
  `checkout-schema.ts`). Lectura: `getMyAccount()` (`src/lib/account.ts`, `cache()`, en `<Suspense>`).
- **Mis pedidos** (`getMyOrders(userId)`): cliente de sesión + `.eq("customer_id", userId)` (obligatorio: a un admin
  el RLS le deja ver todo). No muestra intentos de pago vencidos sin pagar. El detalle es la misma
  `/pedido/{id}?t=…` (el token se deriva del id con `orderToken()`). Estado corto: `customerOrderStatus()`.
  Cada pedido es una tarjeta: si está **en camino**, empresa + código con "Copiar" + "Seguir mi envío"
  (`trackingFor()` de `carriers.ts`, igual que la página del pedido); si está **listo para retirar**, la dirección
  y los horarios guardados en el pedido (`pickup_address` / `pickup_hours`).
- **Pedidos de invitado**: `link_my_guest_orders()` (security definer) asigna `customer_id` a los pedidos sin dueño
  con el mismo email, **solo si el email está verificado**. Se llama en cada ingreso (idempotente).
- **Checkout con sesión**: `startCheckout` guarda `customer_id` = id de la sesión (nunca del formulario).
  El formulario se completa con la cuenta (lo que falte, de `hd_datos_compra`), no escribe `hd_datos_compra`, y
  "Guardar estos datos en mi cuenta" actualiza el perfil (la dirección solo si eligió envío).
- **Eliminar mi cuenta** (Ley 25.326): `deleteMyAccount()` con el id de la sesión → `auth.admin.deleteUser`.
  `profiles` se borra en cascada; los pedidos quedan con `customer_id` en null (FK `on delete set null`) para la
  contabilidad. Las cuentas admin no se eliminan desde la tienda. Borra también `hd_datos_compra` del navegador.
- `/pedido/[id]` vacía el carrito solo si el pedido aprobado es reciente (< 3 h, el regreso de Mercado Pago):
  abrir un pedido viejo desde Mis pedidos o un mail no borra el carrito actual.
- **Probar como cliente con la tienda sin lanzar**: `STORE_PREVIEW_LOCAL=1` en `.env.local` + `npm run dev`. Solo
  funciona con `NODE_ENV=development` (en Vercel nunca): el proxy deja ver la tienda real a cualquier visitante.
  Para un cliente de prueba, un alias del Gmail de Leo con `+prueba-…` (no está en `admin_emails`).

### Pedidos en el panel (paso 5, implementado)
- Estados: Envío: Pagado → Preparando → Enviado (empresa + código) → Entregado. Retiro: Pagado → Preparando → Listo
  para retirar → Retirado. "Preparando" se puede saltear. **Nunca hacia atrás.** Cancelado solo desde Pagado, Preparando
  o Listo para retirar.
- **Todo cambio pasa por funciones de la base** (`20261128000002_gestion_pedidos.sql`), `security definer` con
  `is_admin()` primero y errores `HD4xx` con el texto para mostrar: `set_order_status` (tabla de transiciones; de
  `shipped` a `shipped` = corregir el seguimiento), `mark_orders_preparing` (en bloque, saltea los que no pueden),
  `cancel_order` (devuelve el stock con `adjust_stock(…, 'cancelacion')` una sola vez: `stock_returned_at`),
  `resolve_stock_issue` (`apply_stock` / `manual` con nota), `resolve_review` (`dismiss` con nota / `approve` solo si
  MP aprobó y el monto no coincidía), `admin_order_counts` (invoker, contadores de pestañas). Con "Pagado sin stock" o
  "Para revisar" no se puede avanzar el estado hasta resolverlos. `apply_order_stock` (todo o nada) es el único
  descuento de stock de un pedido (webhook y resoluciones).
- **Línea de tiempo**: tabla `order_events` (solo admins leen; escriben las funciones y el servidor). `actor_name` se
  copia al crear el evento (profiles solo deja leer el propio). Los mails también quedan (`email_sent` / `email_failed`).
- Empresas: `shipping_carrier` = `correo_argentino | andreani | oca | otra` (+ nombre y link opcional). Links en
  `src/lib/carriers.ts`: Correo Argentino y OCA solo tienen formulario (link a su página + código para copiar);
  Andreani `/envio/{código}` (**confirmar con el primer envío real**). Nombrar la empresa en la página del pedido del
  cliente está bien (es la que se usó); la regla de no nombrar transportes sigue para el resto de la tienda y los legales.
- Lista (`/admin/pedidos`): pestañas con contador (Para preparar · Preparando · Enviados · Para retirar · Entregados y
  retirados · Todos; `?estado=atencion` desde los avisos), búsqueda (n.º, nombre, email), filtro envío/retiro, filtros
  en la URL (`list-params.ts`). Para preparar / Preparando / Para retirar: del más viejo al más nuevo. Avisos arriba:
  "Pagado sin stock" (rojo), "Para revisar" (ámbar) y "cargá el email del negocio" si falta.
- Selección múltiple: **rótulos de envío** (A4 2 × 2, `src/lib/print/shipping-labels.ts`, "empezar en la posición",
  remitente de `senderForLabel()`: "Home Deko" + razón social/dirección/WhatsApp si están) y **lista de preparación**
  (`src/lib/print/picking-list.ts`: resumen "Para juntar" + por pedido, con casillas). Mismo patrón que las etiquetas:
  armado en mm → SVG (`DocPageSvg`) y PDF (`createDocPdf`) iguales, diálogo compartido `PdfPreviewDialog`
  (`src/components/admin/`), que también usa Etiquetas.
- Detalle (`/admin/pedidos/[id]`): tarjeta **"Próximo paso"** arriba (un botón principal según el estado, con
  confirmación), cliente, entrega (copiar datos, seguimiento), pago (n.º de operación de MP), productos, historial y
  "Cancelar pedido" (aclara que el dinero se devuelve desde MP). WhatsApp con mensaje según el estado
  (`src/lib/order-messages.ts`; teléfono → `549…`).
- Nombres, ciudades y provincias se MUESTRAN con mayúscula inicial (`titleCase()` en `src/lib/format.ts`: "de", "del",
  "la"… en minúscula salvo al principio; respeta "McDonald" y siglas cortas). Lo guardado en la base no se toca.
- Cliente (`/pedido/[id]`): pasos (Pago confirmado → Preparando → En camino → Entregado, o retiro), seguimiento con
  "Copiar código" y "Seguir mi envío", y texto de cancelado.

### Mails (paso 5, implementado)
- **Resend** por API REST (`src/lib/email/send.ts`, sin SDK), plantillas HTML con tablas + texto plano
  (`templates.ts`), armado y registro en el historial (`order-emails.ts`, `sendOrderEmails(id, evento)`).
- Disparadores (siempre con `after()`, nunca demoran la respuesta ni tiran error): webhook `approved` → cliente
  "Pago confirmado" + dueños "Pedido nuevo"; webhook `review` → dueños "Para revisar"; "Enviado" (y corrección del
  código) → cliente; "Listo para retirar" → cliente; "Confirmar el pago igual" → como `approved`.
  `Idempotency-Key` por pedido y tipo: un reintento no duplica.
- Email de los dueños = email del negocio de Configuración (`ownersEmail()`); si está vacío, el aviso no se manda
  (consola + historial) y Pedidos muestra el recordatorio. Reply-to de los mails al cliente: ese mismo email (si hay).
- Logo por URL absoluta (`NEXT_PUBLIC_SITE_URL` + `/brand/logo-horizontal-sin-frase-negro.png`); en local no se ve
  (el mail muestra "Home ♥ Deko" como texto alternativo).
- Dominio: `homedekotrevelin.com` verificado en Resend (registros DNS en Vercel: MX + TXT SPF del subdominio `send`,
  TXT DKIM `resend._domainkey`, DMARC recomendado).

### Cupones (paso 7, implementado)
- Migración `20261201000001_cupones.sql`. Tablas `coupons` (código `^[A-Z0-9-]{3,30}$` en mayúsculas, `kind` =
  `percent | fixed | free_shipping`, `value`, `starts_on`/`ends_on` = **días de Argentina** (vale hasta las 23:59 del
  "hasta"), `max_uses`, `one_per_customer` (por email), `min_purchase` (subtotal de productos), `is_active`),
  `coupon_redemptions` (un uso = un pedido APROBADO; `order_id` único; `released_at` al cancelar; `over_limit`) y
  `coupon_attempts` (límite de intentos). Vista `admin_coupons` (usos, total descontado, `status`:
  paused → expired → exhausted → scheduled → active). `orders.coupon_id` (+ `coupon_code` como foto).
- Seguridad: las tablas solo las leen los admins (RLS `is_admin()`); nadie escribe directo. Panel: `save_coupon`,
  `set_coupon_active`, `delete_coupon` (definer, `is_admin()` primero, errores `HD4xx`). Checkout, **solo
  service_role**: `coupon_quote(p)` (calcula sin guardar), `coupon_attempt(key)`, `create_order` (acepta
  `coupon_code`; si ya no vale → excepción `cupon` con el jsonb del motivo en `detail`). `redeem_order_coupon` (interna).
- **Regla del mejor precio** (en `coupon_quote`, la única cuenta; la usan la vista previa y `create_order`): los
  descuentos NUNCA se suman. Porcentaje: por producto, el cliente paga `min(final_price, lista × (1 − p))`; el cupón
  aporta solo la diferencia. Monto fijo: gana la opción más barata entre A (ofertas con su descuento + cupón sobre los
  productos sin descuento) y B (todo a lista − cupón). Envío gratis: descuento = envío (retiro → no aplica). Nunca
  baja de $ 0; si el total daría $ 0 → `total_cero` ("escribinos por WhatsApp": MP no cobra $ 0). El descuento va en
  `discount_total`; `order_items.unit_price` sigue con el precio de la tienda.
- **Usos**: se cuentan en el webhook (`apply_order_payment` → `redeem_order_coupon`) y en `resolve_review('approve')`,
  NUNCA al crear el pedido. La fila del cupón se bloquea (`for update`): dos aprobaciones simultáneas con el último uso
  se atienden de a una; la segunda **se respeta** (ya pagó) con `over_limit = true` (decisión de Leo) y queda en el
  historial y en la lista. `cancel_order` libera el uso (`released_at`). Un cupón usado no se borra ni cambia código/tipo.
- **Mercado Pago**: con cupón, la preferencia va con UN solo ítem por `orders.total` ("Compra en Home Deko · Pedido
  #N", descripción con el cupón): MP no acepta precios negativos y así coincide con el control de monto. Sin cupón,
  igual que antes.
- Checkout: `CouponField` (`src/components/store/checkout/coupon-field.tsx`) → `checkCoupon` (Server Action) →
  `coupon_quote`. Se vuelve a revisar al cambiar la entrega; si al pagar ya no vale, `startCheckout` devuelve
  `couponError` y el formulario lo quita. **Límite: 10 intentos por minuto por visitante** (`allowCouponAttempt` en
  `src/lib/coupon-rate-limit.ts`: HMAC de la IP con `ORDER_LINK_SECRET`, contado en la base; también cuenta cada pago
  con cupón).
- Textos y formato compartidos: `src/lib/coupons.ts` (mensajes por motivo, estados). Formulario: `src/lib/coupon-schema.ts`.
- Panel `/admin/cupones` (VENTAS): lista con estado, usos ("3 de 50"), descontado, interruptor Activo (optimista) y
  diálogo crear/editar con vista previa en una frase. Se ve "Cupón CÓDIGO" en el detalle del pedido, los mails y la
  página del pedido del cliente. Ayuda: guía `cupones` + preguntas frecuentes.

### Presencia en toda la tienda
- **Botón de WhatsApp flotante** en todas las páginas, con un mensaje ya escrito.
- Redes: **Instagram** (`homedeko.hogar`) y **TikTok**, en el pie de página y el menú.
- Pie de página con los datos del comercio (nombre o razón social, CUIT, dirección) y links a las páginas.

### Páginas de información y legales
Cómo comprar, Envíos y retiros, Cambios y devoluciones, Preguntas frecuentes, Contacto, Sobre nosotros,
Términos y condiciones, Política de privacidad y **Botón de arrepentimiento** (obligatorio en Argentina para
tiendas online). Los textos en un archivo de contenido (como `ayuda.ts`), fáciles de editar.

### Páginas de información + Botón de arrepentimiento (paso 9, implementado)
- Migración `20261203000001_paginas_info_arrepentimiento.sql`. "Sobre nosotros" quedó para más adelante (necesita
  la historia real del negocio).
- `store_settings.dispatch_time` ("Plazo de despacho", texto ≤ 60, opcional): Configuración → páginas, Términos y
  mail "Pago confirmado" ("Despachamos tu pedido en {plazo}"). Vacío = la frase no aparece.
- Páginas en `(tienda)`: `/como-comprar`, `/envios`, `/cambios-y-devoluciones`, `/preguntas-frecuentes` (acordeón con
  `hiddenUntilFound`), `/contacto` (mapa de Google sin clave que se carga recién al tocar "Ver el mapa") y
  `/arrepentimiento`. Textos en `src/content/informacion.ts` con `datosTienda()` (store-settings): lo que falta llega
  null y se omite; **nunca `[COMPLETAR]` en estas páginas ni en el pie** (queda solo en Términos y Privacidad).
  Links en el texto con `[texto](/ruta)` (`RichText`). Componentes en `src/components/store/info/`.
- Navegación (`src/lib/store-nav.ts`): `HELP_LINKS`, `LEGAL_LINKS`, `WITHDRAWAL_LINK`, `CONSUMER_DEFENSE_URL`.
  Pie: Ayuda · Legales (+ botón destacado en rojo) · El local, y "Defensa de las y los Consumidores. Para reclamos
  ingresá aquí". Sin lanzar, el pie muestra solo links de `ALWAYS_PUBLIC_PATHS`. Menú hamburguesa: grupos Ayuda (con
  el botón destacado) y Legales. PC: "Ayuda ▾" y el botón a la derecha de la barra de categorías (va siempre).
- **Botón de arrepentimiento (Disp. 954/2025, deroga la Res. 424/2020)**: link "a simple vista, en lugar destacado y
  en el primer acceso", **sin registración ni trámites** (nombre + email; n.º de pedido y motivo opcionales) y
  **código de identificación dentro de las 24 h por el mismo medio** (se muestra al instante y va por mail). No
  quitar el link del pie, el menú ni el encabezado. La Res. 274/2021 (link a la Ventanilla Federal) figura abrogada
  por la Disp. 890/2025; el link a Defensa del Consumidor se deja igual.
  - Tabla `withdrawal_requests` (código `ARR-XXXXXX`, estados `new | in_progress | resolved | rejected`, `order_id`
    solo si número + email coinciden, `*_email_sent_at`) y `withdrawal_attempts`. Solo admins leen; nadie escribe directo.
  - `create_withdrawal_request(p, key)` (invoker, solo service_role): límite 3 cada 10 min y 10 por día por visitante
    (`visitorKey("arrepentimiento")` en `src/lib/rate-limit.ts`, el mismo HMAC de IP que los cupones) y 3 por día por
    email → `HD429`. Server Action `submitWithdrawal` con honeypot (`website`) → `after(sendWithdrawalEmails)`
    (`src/lib/email/withdrawal-emails.ts`: cliente con el código + dueños con el link al panel).
  - Panel `/admin/arrepentimientos` (pestañas Nuevas · En gestión · Cerradas · Todas) y detalle con "Próximo paso":
    `set_withdrawal_status` (definer, `is_admin()`; no vuelve a `new`; "No corresponde" exige nota). Aviso si el mail
    del código no salió. `admin_home_attention()` suma `pending_withdrawals` (ítem en "Requiere atención").
  - Ayuda: guía `arrepentimientos` + 2 preguntas frecuentes.

### Dominio
- Se construye y prueba con `homedeko.vercel.app`. Cuando esté el dominio final, actualizar: Vercel,
  Supabase (Site URL y Redirect URLs), Google (orígenes y marca), Mercado Pago (URL del webhook)
  y el servicio de emails (verificación del dominio).
- Dominio final: **`https://www.homedekotrevelin.com`** (con www). Ese valor exacto va en `NEXT_PUBLIC_SITE_URL` de
  producción y en la URL del webhook de MP (`https://www.homedekotrevelin.com/api/mercadopago/webhook`).
- Lanzamiento con pagos reales: cambiar `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` por las credenciales
  de producción y configurar el webhook en modo productivo.
- Lanzamiento, al terminar las pruebas: **reiniciar la numeración de pedidos a #1001** (decidido el 24/11/2026; los
  pedidos de prueba #1003–#1016 ya se borraron ese día y el contador quedó en #1017). Antes, confirmar que no haya
  pedidos reales: `select count(*) from public.orders;` → 0. Después:
  `alter table public.orders alter column order_number restart with 1001;`
- Lanzamiento: **compra real con cupón: verificar uso contado, mail, página del pedido y que vuelva al cancelar**
  (pendiente del paso 7: la prueba local del 24/11/2026 no llegó a aprobar el pago, así que esto no se probó en el navegador).

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
- Correr `npm test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` antes de cada commit.
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
