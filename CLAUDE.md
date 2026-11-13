# Home-Deko — E-commerce + Panel de administración

## Contexto del proyecto
E-commerce para "Home-Deko", un negocio de bazar y artículos para el hogar con local físico.
Los dueños son 2 personas (una pareja). Ambos son administradores con todos los permisos.
El objetivo es que el panel sea **profesional, intuitivo y fácil de usar** para gente no técnica,
y que funcione bien tanto en PC como en celular.

- Fecha objetivo de entrega: **4 de diciembre de 2026**.
- Idioma de toda la interfaz: **español (Argentina)**. Moneda: **ARS** (formato `$ 12.345,67`).
- Desarrollador: Leo (trabaja con Claude Code, una función por vez).

## Stack
- **Next.js** (App Router, TypeScript, Server Components y Server Actions)
- **Tailwind CSS** + **shadcn/ui** para todos los componentes de interfaz
- **Supabase**: Postgres, Auth, Storage (imágenes) y RLS
- **Vercel** para el despliegue (push a `main` = producción; otras ramas = preview)
- **Mercado Pago** (Checkout Pro + webhooks) — se integra en una fase posterior

## Estructura general
- Un solo proyecto Next.js:
  - Tienda pública en `/`
  - Panel de administración en `/admin` (protegido: solo usuarios administradores)
- La tienda y el panel leen y escriben **las mismas tablas**. No hay "conexión posterior" entre sistemas.

## Diseño e identidad visual
Marca (nueva identidad, propuesta de logo de noviembre 2026): "Home Deko — Artículos del hogar".
Logo en serif display de alto contraste, con un corazón rojo ("decorar con amor").
Concepto: "Tu casa, tu refugio, con diseño y calidez". Elegante pero accesible.
Versiones del logo: horizontal (una línea), apilada (dos líneas), negra sobre blanco y blanca sobre rojo.
Los archivos van en `public/brand/`.

Paleta oficial (configurar como variables CSS del tema de shadcn en `globals.css`):
- **Rojo Home Deko**: `#C92728` → color de marca / acento
- **Rojo hover**: `#A81F20`
- **Rojo suave** (fondos de badges y avisos de marca): `#FCEAEA`
- **Negro de marca**: `#2B2B2B` → texto principal y botones primarios del panel
- **Blanco**: `#FFFFFF`
- **Gris** para bordes y textos secundarios (escala `neutral` o `stone` de Tailwind)
- **Fondo del panel**: `#FAFAFA`
- (El rosa claro de la presentación de marca es solo el fondo del documento: no usarlo en la interfaz.)

Tipografías de marca:
- **Frunchy Sage** (display serif): solo títulos de la tienda y elementos de marca. Nunca en tablas ni formularios.
- **Gabriel Sans** (sans serif): textos.
- Cargarlas con `next/font/local` desde `public/fonts/` cuando estén los archivos (y la licencia de uso web).
  Mientras tanto, usar como alternativa **Playfair Display** (display) e **Inter** (textos) con `next/font/google`.

### Panel de administración (lo usa principalmente uno de los dueños: sobrio y profesional)
- Base **neutra**: fondo claro, tarjetas blancas, bordes finos y mucho espacio. Nada de rosa.
- **Botones primarios en negro de marca** (`#2B2B2B`), no en rojo, para no confundirlos con acciones de peligro.
- El **rojo de marca solo como acento**: logo, ítem activo de la barra lateral, indicadores, gráficos y foco.
- Acciones destructivas (archivar o eliminar): botón con borde, más diálogo de confirmación.
- Colores de estado: verde para "Publicado" o stock OK, ámbar para "Stock bajo", gris para
  "Borrador" o "Archivado", y rojo de marca para "Sin stock".
- Tipografía del panel: **Gabriel Sans** (o Inter como alternativa). Números tabulares en tablas, precios y stock.
- Barra lateral con el **logo horizontal** arriba. En la pantalla de login, el **logo apilado**.
  Favicon: el corazón rojo.

### Tienda (más adelante)
- Más presencia del rojo: botones "Agregar al carrito" y "Comprar" en rojo de marca.
- Títulos en **Frunchy Sage** y cuerpo en **Gabriel Sans**.
- Bloques o banners en rojo con el logo en blanco, como en la propuesta de marca.
- Mucho blanco y fotos grandes: el producto es el protagonista.

## Variables de entorno
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` → **solo en el servidor**. Nunca importarla en código de cliente
  ni usarla con el prefijo `NEXT_PUBLIC_`.

## Reglas de base de datos (obligatorias)
- Todo cambio de esquema se hace con **migraciones de la Supabase CLI** (`supabase/migrations/`),
  nunca creando tablas a mano en el dashboard. Se aplican con `npx supabase db push`.
- El proyecto tiene **RLS automático activado** y la **exposición automática de tablas desactivada**.
  Por lo tanto, **cada migración que cree una tabla debe incluir**:
  1. `alter table ... enable row level security;`
  2. Los `GRANT` necesarios para los roles `anon` y/o `authenticated`.
  3. Las policies correspondientes.
- Función `is_admin()` (security definer) para usar en las policies del panel.
- La tienda pública solo puede leer productos con estado `active` y sus datos relacionados.
- Usar `uuid` como clave primaria, `created_at` / `updated_at` con trigger.
- **Archivar, no borrar**: los productos tienen estado `draft | active | archived`.

## Usuarios y roles
- Inicio de sesión con **Google** (botón "Continuar con Google") y con **email y contraseña**.
- El registro está habilitado (Google lo necesita), pero **crear una cuenta no da ningún permiso**.
  La seguridad está en el rol, no en el registro.
- **Lista de emails autorizados** (tabla `admin_emails`, solo editable por admins o desde SQL):
  cuando un usuario se registra o inicia sesión por primera vez, un trigger sobre `auth.users`
  revisa si su email está en la lista y, si está, le asigna el rol `admin` en `profiles`.
- Tabla `profiles` vinculada a `auth.users` con el rol (`admin` o `customer`).
- Todo `/admin` está protegido: si el usuario no es admin, se lo redirige con un mensaje claro
  ("Tu cuenta no tiene acceso al panel").
- Ruta de callback de OAuth: `/auth/callback`.
- Seguir la guía oficial de `@supabase/ssr` para la versión de Next.js instalada
  (clientes de navegador y servidor + manejo de sesión).

## Modelo de productos
- **Producto**: nombre, slug, descripción, categoría, precio base, estado, destacado, descuento opcional.
- **Opciones libres por producto**: por ejemplo "Color" y "Medida", con valores de texto libre
  (pueden ser medidas raras: "12x30 cm", "Ø 18", "1,5 L"). Color con un hex opcional para mostrar una muestra.
- **Variantes**: cada combinación de opciones (ej.: 3 colores × 2 medidas = 6 variantes).
  - El **stock, el stock mínimo, el SKU y el código de barras van por variante**.
  - Precio opcional por variante (si está vacío, usa el precio base del producto).
  - Un producto sin variantes tiene **una sola variante por defecto** (todo funciona igual).
- **Imágenes**: varias por producto, reordenables, con imagen principal; opcionalmente asociadas
  a un color. Se guardan en Supabase Storage (bucket `product-images`) y se **comprimen antes de subir**.
- **Precio de costo**: en una tabla aparte, **solo legible por admins** (RLS es por fila, no por columna;
  no ponerlo en una tabla que la tienda pueda leer).
- **Descuento opcional por producto**: porcentaje o monto fijo, con fecha de inicio y fin opcionales.
  Solo aparece si los dueños lo agregan.

## Códigos de barra
- **Todos los genera el sistema**, automáticamente, al crear cada variante.
- Formato: **EAN-13 con prefijo `200`** (rango de uso interno) + secuencia + dígito verificador,
  generado en la base de datos (secuencia + función).
- **Un código nunca cambia** una vez creado (proteger con trigger).
- El precio **no** va en la etiqueta: se consulta en el sistema al escanear. Así nunca se reimprime.

## Stock
- El stock **no se edita a mano** en el formulario: se usa "Ajustar stock" con motivo.
- Tabla `stock_movements`: variante, cantidad (+/-), motivo (`inicial`, `ingreso`, `venta_web`,
  `venta_local`, `ajuste`, `rotura`, `devolucion`), nota, usuario, fecha, pedido opcional.
- Todo cambio de stock pasa por una **función de Postgres atómica** (`adjust_stock`) que actualiza
  el stock, impide que quede negativo y registra el movimiento.
- Cada variante tiene `min_stock` para las alertas de "poco stock".

## Escaneo
- Un único componente de búsqueda que acepta dos entradas:
  1. Texto tipeado (nombre, SKU o código)
  2. **Lector USB** (actúa como teclado: escribe el código y presiona Enter)
- El escáner con la cámara del celular **no se implementa**: va en el extra futuro "App Home Deko".
- Al escanear, abre el producto o variante correspondiente.

## Etiquetas (impresión A4)
- **Cola de impresión** tipo carrito: "Agregar a etiquetas" desde el listado o el producto, con cantidad.
- Pantalla de etiquetas: ver la cola, ajustar cantidades y quitar ítems.
- **Vista previa del PDF exacto** antes de generar, con botones "Descargar PDF" e "Imprimir".
- Formato de la hoja:
  - A4, grilla configurable (por defecto 4 columnas × 10 filas = 40 etiquetas).
  - Etiquetas **agrupadas por producto/variante**: cada grupo empieza en una fila nueva con un título
    chico, ej.: "Taza – Rojo / 300 ml (12)".
  - Cada etiqueta: nombre corto + variante + código de barras + número.
  - **Líneas punteadas de corte** entre etiquetas.
  - Opción "empezar en la posición X" para reaprovechar hojas.
- Códigos de barras renderizados en vector (SVG) para que se impriman nítidos.

## Panel de productos — funciones
- **Listado**: miniatura, nombre, SKU, precio, stock total, estado; búsqueda (incluye escaneo);
  filtros por categoría, estado y stock bajo; orden; paginación; selección múltiple con acciones
  masivas (imprimir etiquetas, publicar u ocultar, cambiar categoría, archivar).
- **Formulario**: datos generales, interruptor "Este producto tiene variantes", editor de opciones
  con chips, tabla de combinaciones generada automáticamente (stock inicial, precio opcional y
  eliminar combinaciones que no existen), imágenes con drag & drop, estado y descuento.
  Botones **"Guardar"** y **"Guardar y cargar otro"**. Opción **"Duplicar producto"**.
- **Categorías**: alta, edición, baja y orden.
- **Ajuste de stock** e **historial de movimientos** por variante.
- Detalles de calidad: validaciones claras, avisos (toast) al guardar, confirmación antes de
  acciones destructivas, estados de carga y diseño responsive.

## Más adelante (no implementar todavía)
- Pantalla "Venta rápida" en el local (escanear → cantidad → descuenta con motivo `venta_local`).
- Tienda pública, carrito y checkout con Mercado Pago (el webhook confirma el pago consultando la API
  de Mercado Pago y descuenta stock vía `adjust_stock`; nunca confiar en la redirección).
- Panel general: últimas ventas, poco stock y métricas.
- Módulo "App Home Deko" (extra a cotizar): PWA instalable, escáner con la cámara del celular,
  venta rápida en el local y notificaciones. Hoy el escaneo funciona solo con lector USB.

## Forma de trabajo
- **Una función por vez**: implementar, probar en `localhost:3000`, commit y recién ahí seguir.
- Trabajar en ramas (`git checkout -b nombre-funcion`), nunca directo en `main`.
- Antes de crear algo grande, proponer primero el plan y los archivos a tocar.
- Código claro y comentado en las partes no obvias, pensando en que Leo está aprendiendo.

## Orden de implementación del panel
1. Migración de base de datos (todas las tablas de productos y stock + RLS + grants + funciones)
2. Login y protección de `/admin`
3. Layout del panel (barra lateral: Productos, Categorías, Etiquetas, Stock)
4. Categorías
5. Formulario de producto con variantes e imágenes
6. Listado con buscador y filtros
7. Ajuste de stock e historial
8. (Extra futuro, NO implementar) Escáner con cámara: va en el módulo "App Home Deko" (PWA)
9. Cola de etiquetas y PDF A4

## Arquitectura del panel (visión final)
Menú agrupado por tarea. Cada sección se agrega al menú recién cuando está implementada.
- Inicio (resumen)
- VENTAS: Pedidos (contador de pendientes), Venta en local
- CATÁLOGO: Productos, Categorías
- INVENTARIO: Stock (contador de stock bajo), Etiquetas
- ANÁLISIS: Estadísticas (más vendidos, más vistos, ingresos)
- Abajo: Configuración y "Ver tienda"

Inicio = "qué tengo que hacer hoy":
1. Selector de período (Hoy / 7 días / 30 días)
2. Tarjetas: ventas, pedidos, ticket promedio, visitas (con variación vs. período anterior)
3. Caja "Requiere atención": pedidos sin preparar, sin stock, stock bajo (con botones de acción)
4. Gráfico de ventas por día
5. Más vendidos y más vistos
6. Últimos pedidos

Visitas por producto: tabla de vistas registrada desde la página del producto en la tienda.

## Pruebas y datos reales
- La base de Supabase es la de producción: los dueños cargan productos reales.
- Las pruebas de SQL corren dentro de una transacción con rollback.
- Las pruebas de punta a punta solo crean datos con el prefijo "prueba-" y los borran al terminar.
- Nunca modificar ni borrar datos que no hayan sido creados por la prueba.
- Si una prueba necesita crear muchos datos, avisar antes.