/**
 * Textos de la AYUDA del panel.
 *
 * Todo lo que se lee en /admin/ayuda y en los paneles "¿Cómo funciona?" de
 * cada sección sale de este archivo. Para cambiar un texto, editalo acá:
 * no hace falta tocar ningún componente.
 *
 * Reglas para que se vea bien:
 *   - Frases cortas, en voseo ("Tocá", "Elegí") y con los MISMOS nombres de
 *     botón que aparecen en pantalla (entre comillas).
 *   - `pasosRapidos`: 3 o 4 pasos (el panel lateral es angosto en el celular).
 *   - `pasos`: la versión completa, para la página de Ayuda.
 */

import type { PanelFeature } from "@/components/admin/nav-items";

// ---------------------------------------------------------------------------
// Contacto
// ---------------------------------------------------------------------------

export const CONTACTO = {
  nombre: "Leo",
  /**
   * Número de WhatsApp SOLO con dígitos y código de país, sin "+" ni espacios.
   * Ej.: Argentina, celular de CABA → "5491112345678".
   * Mientras esté vacío, el botón de WhatsApp no se muestra.
   */
  whatsapp: "5491141583706",
  /** Mensaje que aparece ya escrito al abrir el chat. */
  mensaje: "Hola Leo, tengo una duda con el panel de Home Deko.",
};

/** Link para abrir el chat de WhatsApp (o null si todavía no hay número). */
export function whatsappHref(): string | null {
  const numero = CONTACTO.whatsapp.replace(/\D/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(CONTACTO.mensaje)}`;
}

// ---------------------------------------------------------------------------
// Guías por sección
// ---------------------------------------------------------------------------

export type GuiaId =
  | "inicio"
  | "pedidos"
  | "cupones"
  | "arrepentimientos"
  | "productos"
  | "categorias"
  | "etiquetas"
  | "stock"
  | "apariencia"
  | "configuracion";

export type Guia = {
  id: GuiaId;
  /** Título en la página de Ayuda y en el panel lateral. */
  titulo: string;
  /** Una frase que explica para qué sirve la sección. */
  resumen: string;
  /** 3 o 4 pasos cortos para el panel "¿Cómo funciona?". */
  pasosRapidos: string[];
  /** Pasos completos (título + explicación) para la página de Ayuda. */
  pasos: { titulo: string; texto: string }[];
  /**
   * Guía de una sección reservada: se muestra solo a quien tiene ese permiso
   * (el mismo que el menú; ver PanelFeature en nav-items.ts). Hoy "appearance"
   * es solo para el desarrollador; si se habilita a los dueños, aparece sola.
   */
  feature?: PanelFeature;
};

export const GUIAS: Record<GuiaId, Guia> = {
  inicio: {
    id: "inicio",
    titulo: "Inicio: ventas y visitas",
    resumen: "Cómo viene la tienda online: lo que hay que resolver, las ventas, lo más vendido y cuánta gente entra.",
    pasosRapidos: [
      "Arriba de todo, \"Requiere atención\" junta lo que hay que resolver (pedidos para preparar, stock, datos que faltan). Cada aviso tiene su botón. Si no hay nada, dice \"Todo al día\".",
      "Elegí el período (Hoy, 7 días, 30 días, Este mes…). Cada número muestra si subió o bajó contra el período anterior.",
      "En el gráfico, pasá el mouse o tocá una barra para ver la fecha, el monto y los pedidos.",
      "Abajo están las visitas: cuánta gente entra, de dónde viene y qué productos miran más.",
    ],
    pasos: [
      {
        titulo: "Qué cuenta como venta",
        texto:
          "Solo los pedidos de la tienda online con el pago aprobado por Mercado Pago. Los cancelados no cuentan (si cancelan un pedido, sale solo de los números), y tampoco los que quedaron sin pagar o \"Para revisar\". Cada venta cuenta el día en que se aprobó el pago, en hora de Argentina. El monto es el total cobrado, con el envío incluido (la tarjeta dice cuánto fue de envíos).",
      },
      {
        titulo: "Los períodos y la comparación",
        texto:
          "\"Hoy\" se compara con ayer; \"7 días\" y \"30 días\", con los 7 o 30 días anteriores; \"Este mes\", con los mismos días del mes pasado (por ejemplo, del 1 al 24 contra el 1 al 24); \"Mes anterior\", con el mes de antes; \"Este año\", con el mismo tramo del año pasado. En \"Personalizado\" elegís las fechas y se compara con la misma cantidad de días justo antes. \"Nuevo\" quiere decir que antes había cero.",
      },
      {
        titulo: "El gráfico",
        texto:
          "Se agrupa solo según el período: por día, por semana o por mes. Arriba a la derecha podés cambiarlo. Arriba dice el total y el mejor día (o semana, o mes). Para un solo día no hay gráfico: elegí 7 días o más.",
      },
      {
        titulo: "Las visitas",
        texto:
          "La tienda cuenta las visitas por su cuenta, de forma anónima: sin cookies y sin guardar nada de quien entra (ni IP, ni nombre, ni el dispositivo). Solo se suma uno al contador del día. No se cuentan ustedes (con la sesión del panel iniciada) ni los robots de Google y otros buscadores. Una visita es una persona que entra a la tienda; si mira varias páginas, sigue siendo una visita.",
      },
      {
        titulo: "Conversión y \"Mucho interés, pocas ventas\"",
        texto:
          "La conversión es cuántas visitas terminan en una compra: pedidos ÷ visitas. En una tienda online lo normal es entre 1 % y 3 %. En \"Productos más vistos\", la marca \"Mucho interés, pocas ventas\" aparece en los que muchos abren pero pocos compran: puede valer la pena revisar el precio, las fotos o la descripción.",
      },
      {
        titulo: "De dónde vienen las visitas",
        texto:
          "Se reconoce si la persona llegó desde Instagram, TikTok, Facebook, Google o WhatsApp. \"Directo\" es quien escribió la dirección, usó un favorito o vino desde una app que no avisa de dónde viene (WhatsApp casi nunca avisa). Para que un link se cuente bien, agregale al final ?utm_source= y el nombre de la red. Por ejemplo, en la bio de Instagram: www.homedekotrevelin.com/?utm_source=instagram (y en WhatsApp: ?utm_source=whatsapp).",
      },
    ],
  },

  pedidos: {
    id: "pedidos",
    titulo: "Pedidos",
    resumen: "Los pedidos de la tienda online: qué preparar, qué despachar y en qué estado está cada uno.",
    pasosRapidos: [
      "En \"Para preparar\" están los pedidos ya pagados. Tildalos y tocá \"Lista de preparación\" para juntar los productos.",
      "Para los envíos, tocá \"Imprimir rótulos\" (4 por hoja) y pegá cada uno en su paquete.",
      "Al despachar, entrá al pedido, elegí la empresa, cargá el código de seguimiento y tocá \"Marcar como enviado\". Al cliente le llega un mail.",
      "Si arriba ves un aviso rojo o amarillo, ese pedido necesita que lo revisen antes de prepararlo.",
    ],
    pasos: [
      {
        titulo: "Cómo llega un pedido",
        texto:
          "El cliente completa sus datos, elige envío a domicilio o retiro en el local y paga en Mercado Pago. Recién cuando Mercado Pago confirma el pago, el pedido aparece en \"Para preparar\" y se descuenta el stock solo (en Stock lo ves como \"Venta web\"). Los precios y el costo del envío quedan guardados en el pedido tal como estaban al comprar: si después los cambian, ese pedido no cambia.",
      },
      {
        titulo: "Cómo despachar un pedido (paso a paso)",
        texto:
          "1. Entrá a Pedidos: arriba de todo están los avisos (si hay).\n2. En la pestaña \"Para preparar\", tildá los pedidos que vas a armar (o \"Seleccionar todos\"). Los más viejos aparecen primero.\n3. Tocá \"Lista de preparación\" e imprimila: arriba dice todo lo que hay que juntar del depósito, sumado; abajo, pedido por pedido, para armar cada caja. Tildá con birome a medida que juntás.\n4. Tocá \"Imprimir rótulos\": salen 4 por hoja A4, con los datos del cliente y los de Home Deko como remitente. Recortá por las líneas punteadas y pegá cada uno en su paquete.\n5. Tocá \"Marcar como Preparando\": así queda claro que ya se están armando.\n6. Cuando despaches cada paquete, entrá al pedido, elegí la empresa (Correo Argentino, Andreani, OCA u Otra), escribí el código de seguimiento del comprobante y tocá \"Marcar como enviado\". Al cliente le llega un mail con el seguimiento.\n7. Si querés, tocá \"Avisar por WhatsApp\": se abre el chat con el mensaje ya escrito.\n8. Cuando el cliente lo recibe, entrá al pedido y tocá \"Marcar como entregado\".",
      },
      {
        titulo: "Pedidos para retirar en el local",
        texto:
          "Se preparan igual (lista de preparación y \"Preparando\"), pero no llevan rótulo. Cuando el paquete está armado, entrá al pedido y tocá \"Listo para retirar\": al cliente le llega un mail con la dirección y los horarios. Cuando pasa a buscarlo, tocá \"Marcar como retirado\".",
      },
      {
        titulo: "Las pestañas",
        texto:
          "\"Para preparar\": pagados, todavía sin armar. \"Preparando\": se están armando. \"Enviados\": en camino. \"Para retirar\": listos, esperando al cliente en el local. \"Entregados y retirados\": terminados. \"Todos\": todo junto, también los cancelados; con \"Ver también los que no se pagaron\" suma los intentos que quedaron sin pagar (alguien que llegó a Mercado Pago y no terminó), que no descuentan stock ni requieren nada. Podés buscar por número de pedido, nombre o email, y filtrar solo envíos o solo retiros.",
      },
      {
        titulo: "El detalle del pedido",
        texto:
          "Arriba de todo, \"Próximo paso\" dice qué hay que hacer con ese pedido y tiene el botón para hacerlo. Más abajo están los productos, los datos del cliente (con botones para copiar y para escribirle por WhatsApp), la dirección de envío (con \"Copiar\" para pegarla en el formulario del correo), el pago y el historial: cada cambio, quién lo hizo y cuándo, incluidos los mails que se mandaron. Los estados solo avanzan: un pedido enviado no puede volver a \"Preparando\". Si te equivocaste con el código de seguimiento, usá \"Corregir la empresa o el código\".",
      },
      {
        titulo: "Mails automáticos",
        texto:
          "Al cliente le llega un mail cuando se confirma el pago, cuando lo marcan como enviado (con el código de seguimiento) y cuando está listo para retirar. A ustedes les llega un aviso por cada pedido nuevo al email del negocio que cargaron en Configuración (si no está cargado, no se manda y en Pedidos aparece un recordatorio). En el historial de cada pedido figura cada mail enviado.",
      },
      {
        titulo: "Cancelar un pedido",
        texto:
          "Entrá al pedido y tocá \"Cancelar pedido\" (solo mientras no salió: \"Para preparar\", \"Preparando\" o \"Listo para retirar\"). El stock vuelve solo (en Stock lo ves como \"Cancelación de pedido\"). El dinero NO se devuelve solo: hacelo desde tu cuenta de Mercado Pago (Actividad → buscá el número de operación que figura en el pedido → Devolver dinero).",
      },
      {
        titulo: "Pagado sin stock",
        texto:
          "Pasa muy rara vez: dos personas pagan la última unidad casi al mismo tiempo. El segundo pago se cobra, pero ya no hay stock y no se descuenta nada. Escribile al cliente (el botón de WhatsApp está en el pedido) y elegí: si te entra mercadería, cargá el ingreso en Stock y tocá \"Descontar el stock y seguir\"; si le ofreciste otra cosa, tocá \"Lo resolvimos de otra forma\" y contá qué hicieron; si no se puede, \"Cancelar pedido\" y devolvé el dinero desde Mercado Pago.",
      },
      {
        titulo: "Para revisar",
        texto:
          "El pedido tiene algo raro que conviene mirar antes de prepararlo: por ejemplo, que el monto aprobado por Mercado Pago no coincida con el total, o que un pago se haya devuelto. En el pedido dice el motivo. Si el monto no coincidía pero en Mercado Pago ves el pago acreditado y te parece bien, tocá \"Confirmar el pago igual\". Si el pago se devolvió, cancelá el pedido. Si ya lo revisaron y está todo bien, \"Marcar como revisado\".",
      },
    ],
  },

  arrepentimientos: {
    id: "arrepentimientos",
    titulo: "Solicitudes de arrepentimiento",
    resumen:
      "Las solicitudes del \"Botón de arrepentimiento\" de la tienda: un cliente que compró online y quiere devolver su compra dentro de los 10 días.",
    pasosRapidos: [
      "Cuando llega una solicitud te avisamos por mail y aparece en \"Nuevas\" (con un número en el menú y en el Inicio).",
      "El cliente ya recibió su código (ARR-…) en pantalla y por mail: no tenés que mandárselo.",
      "Escribile (mail o WhatsApp) para coordinar la devolución del producto y marcala \"En gestión\".",
      "Cuando vuelva el producto, devolvé el dinero desde Mercado Pago y marcala \"Resuelta\".",
    ],
    pasos: [
      {
        titulo: "Qué es el Botón de arrepentimiento",
        texto:
          "Es obligatorio por ley para las tiendas online (Disposición 954/2025): un link que está en el pie de todas las páginas, en el menú y arriba en la computadora. Quien compró online tiene 10 días corridos desde que recibió el producto para arrepentirse, sin dar explicaciones y sin costo. El cliente no necesita cuenta: solo deja su nombre, su email y, si lo sabe, el número de pedido y un motivo.",
      },
      {
        titulo: "El código de la solicitud",
        texto:
          "La ley pide darle al cliente un código de su solicitud dentro de las 24 horas. La tienda se lo muestra apenas la envía y además se lo manda por mail, así que no tenés que hacer nada. En el detalle de la solicitud ves si el mail salió; si dice que no salió, mandale el código vos.",
      },
      {
        titulo: "El pedido",
        texto:
          "Si el número de pedido y el email coinciden con una compra, la solicitud muestra el link al pedido. Si el número no coincide con el email (o no lo puso), buscalo en Pedidos por el nombre o el email del cliente.",
      },
      {
        titulo: "Gestionarla",
        texto:
          "Desde el detalle podés escribirle por mail (o por WhatsApp si la solicitud está vinculada a un pedido). Coordiná cómo vuelve el producto: los gastos de devolución corren por cuenta de la tienda. Cuando te contactes, marcala \"En gestión\". Cuando el producto vuelva, devolvé el total pagado (con el envío) desde tu cuenta de Mercado Pago (Actividad → el pago → Devolver dinero) y marcala \"Resuelta\". Si el pedido estaba sin despachar, también podés cancelarlo desde Pedidos: el stock vuelve solo.",
      },
      {
        titulo: "Cuándo marcar \"No corresponde\"",
        texto:
          "Si pasaron más de 10 días desde que recibió el producto, si el producto ya se usó o si la compra no fue por la tienda online. Antes de marcarla, explicale el motivo al cliente. Te pide una nota obligatoria para que quede registrado por qué.",
      },
    ],
  },

  cupones: {
    id: "cupones",
    titulo: "Cómo crear un cupón",
    resumen: "Códigos de descuento que tus clientes escriben al pagar en la tienda online.",
    pasosRapidos: [
      "Tocá \"Nuevo cupón\", escribí el código (por ejemplo BIENVENIDA) y elegí el tipo: porcentaje, monto fijo o envío gratis.",
      "Si querés, poné fechas, usos máximos, compra mínima o \"Un uso por cliente\". Arriba ves el cupón resumido en una frase.",
      "Tocá \"Crear cupón\" y compartí el código con tus clientes (Instagram, WhatsApp, el local).",
      "Para frenarlo, apagá el interruptor \"Activo\". En la lista ves cuántas veces se usó y cuánto se descontó.",
    ],
    pasos: [
      {
        titulo: "Crear un cupón",
        texto:
          "Tocá \"Nuevo cupón\". Escribí el código (se guarda en mayúsculas y sin espacios; \"Generar\" inventa uno al azar). Elegí el tipo:\n• Porcentaje: un % menos en los productos.\n• Monto fijo: una cantidad de pesos menos en los productos.\n• Envío gratis: el envío a domicilio sale $ 0 (si el cliente elige retiro en el local, no aplica).\nEl porcentaje y el monto fijo se descuentan de los productos, nunca del envío. Lo demás es opcional: fechas desde/hasta, usos máximos en total, \"Un uso por cliente\" (por email) y compra mínima (en productos, sin el envío). Arriba del formulario ves cómo queda, en una frase. Tocá \"Crear cupón\".",
      },
      {
        titulo: "Ejemplo 1: 10 % de bienvenida",
        texto:
          "Código BIENVENIDA · Porcentaje · 10 · sin fechas · \"Un uso por cliente\" encendido. Cada cliente lo puede usar una sola vez (se controla por el email de la compra). Ideal para ponerlo en la bio de Instagram: \"10 % en tu primera compra con el código BIENVENIDA\".",
      },
      {
        titulo: "Ejemplo 2: envío gratis por una semana",
        texto:
          "Código ENVIOGRATIS · Envío gratis · Desde el lunes · Hasta el domingo. Si querés que sea solo para compras grandes, poné una compra mínima (por ejemplo $ 50.000). Empieza a funcionar solo el día \"desde\" (hasta entonces figura como \"Programado\") y se apaga solo después de las 23:59 del día \"hasta\" (pasa a \"Vencido\").",
      },
      {
        titulo: "Si el producto ya tiene descuento",
        texto:
          "Los descuentos nunca se suman: se aplica el que más le conviene al cliente. Por ejemplo, con un cupón del 10 %: un mantel que ya tiene -20 % se queda con su -20 % (es mejor), y una taza sin descuento recibe el 10 % del cupón. Lo calcula la tienda sola.",
      },
      {
        titulo: "Estados de la lista",
        texto:
          "Activo (verde): funciona ahora. Programado: todavía no llegó la fecha \"desde\". Pausado: lo apagaron con el interruptor. Vencido: pasó la fecha \"hasta\". Agotado (ámbar): llegó a los usos máximos. \"Usos\" cuenta solo los pedidos PAGADOS (un pedido sin pagar no gasta un uso) y \"Descontado\" es el total que se descontó en esos pedidos.",
      },
      {
        titulo: "Pausar, editar y eliminar",
        texto:
          "El interruptor \"Activo\" lo pausa o lo vuelve a activar en un clic. \"Editar\" cambia las fechas, los límites o el valor: vale para las compras siguientes (los pedidos ya hechos no cambian). Un cupón que ya se usó no se puede eliminar ni cambiarle el código o el tipo (así el historial de los pedidos tiene sentido): pausalo y, si hace falta, creá otro. Uno que nunca se usó sí se puede eliminar desde el menú de los tres puntos.",
      },
      {
        titulo: "Dónde se ve el cupón",
        texto:
          "En el detalle de cada pedido (fila \"Cupón CÓDIGO\" y en el historial), en el mail de confirmación del cliente y en el aviso de pedido nuevo. Si se cancela un pedido, el uso del cupón vuelve a quedar disponible.",
      },
    ],
  },

  productos: {
    id: "productos",
    titulo: "Productos",
    resumen: "Cargá los productos con sus fotos, precio y variantes (colores, medidas, etc.).",
    pasosRapidos: [
      "Tocá \"Nuevo producto\" y completá nombre, precio y categoría.",
      "Si viene en varios colores o medidas, activá \"Este producto tiene variantes\".",
      "Elegí el estado: \"Borrador\" mientras lo cargás, \"Publicado\" para que se vea en la tienda.",
      "Tocá \"Guardar\" (o \"Guardar y cargar otro\" para seguir cargando).",
    ],
    pasos: [
      {
        titulo: "Cargar un producto",
        texto:
          "Tocá \"Nuevo producto\". Completá el nombre, la descripción, el precio y la categoría. Arrastrá las fotos (la primera es la principal; podés reordenarlas). Al final tocá \"Guardar\", o \"Guardar y cargar otro\" si vas a seguir cargando.",
      },
      {
        titulo: "Variantes (colores, medidas…)",
        texto:
          "Activá \"Este producto tiene variantes\" y agregá una opción, por ejemplo \"Color\" o \"Medida\". Escribí cada valor y apretá Enter: queda como un chip. El sistema arma solo todas las combinaciones (3 colores × 2 medidas = 6). En la tabla poné el stock inicial de cada una y, si alguna no existe, quitala.",
      },
      {
        titulo: "Precio por variante",
        texto:
          "Si una variante cuesta distinto, escribí su precio en la tabla. Si lo dejás vacío, usa el precio del producto.",
      },
      {
        titulo: "Publicar, ocultar y archivar",
        texto:
          "\"Borrador\" no lo ven los clientes. \"Publicado\" se ve y se puede comprar. Desde el listado podés seleccionar varios productos y publicarlos, ocultarlos, cambiarles la categoría o archivarlos de una vez.",
      },
      {
        titulo: "Ver cómo queda en la tienda antes de publicar",
        texto:
          "Ustedes, con la sesión iniciada, ven en la tienda también los productos en \"Borrador\", con una etiqueta gris que dice \"Borrador\". Así pueden revisar las fotos y el precio antes de publicarlos. Los clientes nunca los ven. Para ver la tienda exactamente como un cliente, tocá \"Ver como cliente\" en la barra negra de arriba de la tienda.",
      },
      {
        titulo: "Destacados en el inicio",
        texto:
          "Activá \"Destacado\" en un producto publicado para que aparezca en el inicio de la tienda, en la sección \"Destacados\" (se muestran hasta 8, los más nuevos primero).",
      },
      {
        titulo: "Buscar y duplicar",
        texto:
          "En el buscador del listado podés escribir el nombre, el SKU o escanear el código con el lector. Para cargar uno parecido, usá \"Duplicar\" en el menú del producto y cambiá solo lo distinto.",
      },
    ],
  },

  categorias: {
    id: "categorias",
    titulo: "Categorías",
    resumen: "Agrupá los productos (Cocina, Baño, Deco…) para que sea fácil encontrarlos en la tienda.",
    pasosRapidos: [
      "Tocá \"Nueva categoría\", escribí el nombre y, si querés, elegí una imagen.",
      "Tocá \"Crear categoría\".",
      "Para cambiar el orden, arrastrá cada fila desde la manija (⠿).",
      "Para editar o eliminar, usá el menú de los tres puntos de cada fila.",
    ],
    pasos: [
      {
        titulo: "Crear una categoría",
        texto:
          "Tocá \"Nueva categoría\" y escribí el nombre. El \"slug\" (la dirección en la tienda) se completa solo. Podés agregar una imagen. Tocá \"Crear categoría\".",
      },
      {
        titulo: "Ordenarlas",
        texto:
          "Arrastrá cada fila desde la manija (⠿) hasta donde quieras. El orden se guarda solo y es el mismo que se ve en la tienda.",
      },
      {
        titulo: "Editar, ocultar o eliminar",
        texto:
          "En el menú de cada fila elegí \"Editar\" o \"Eliminar\". Solo se puede eliminar una categoría vacía: si tiene productos, editala y apagá \"Visible\" para que no aparezca en la tienda. Al ocultar una categoría, sus productos tampoco se ven en la tienda (siguen en el panel, sin perder nada); vuelven a aparecer cuando la mostrás de nuevo.",
      },
    ],
  },

  etiquetas: {
    id: "etiquetas",
    titulo: "Etiquetas",
    resumen: "Imprimí etiquetas con código de barras en hojas A4, para pegar en los productos.",
    pasosRapidos: [
      "Desde Productos, tocá \"Agregar a etiquetas\" y elegí cuántas querés de cada variante.",
      "Acá revisás la cola: cambiá cantidades o quitá lo que no va.",
      "Si la hoja ya está usada, elegí \"Empezar en la posición\" para aprovecharla.",
      "Mirá la vista previa y tocá \"Imprimir\" o \"Descargar PDF\".",
    ],
    pasos: [
      {
        titulo: "Armar la cola",
        texto:
          "Desde el listado de Productos (o desde un producto) tocá \"Agregar a etiquetas\" y elegí la cantidad de cada variante. Funciona como un carrito: se va juntando todo en la cola.",
      },
      {
        titulo: "Revisar la cola",
        texto:
          "En Etiquetas ves todo lo que vas a imprimir. Usá + y − para cambiar cantidades, o \"Quitar de la cola\". \"Vaciar la cola\" borra todo (después de imprimir, por ejemplo).",
      },
      {
        titulo: "Configurar la hoja",
        texto:
          "Por defecto entran 4 columnas × 10 filas (40 etiquetas por hoja A4). Si ya usaste parte de una hoja, tocá la posición donde querés empezar en \"Empezar en la posición\".",
      },
      {
        titulo: "Imprimir",
        texto:
          "La vista previa muestra exactamente cómo sale el PDF. Tocá \"Imprimir\" o \"Descargar PDF\". Imprimí siempre al 100 % (\"tamaño real\"), sin \"ajustar a la página\", para que las etiquetas coincidan con la hoja.",
      },
    ],
  },

  stock: {
    id: "stock",
    titulo: "Stock",
    resumen: "Registrá lo que entra y sale, mirá qué hay que reponer y el historial de cada movimiento.",
    pasosRapidos: [
      "Cuando llega mercadería, usá \"Ingreso rápido\": escaneá o buscá el producto y poné la cantidad.",
      "Para una rotura, devolución o corrección, tocá \"Ajustar stock\" y elegí el motivo.",
      "En \"Para reponer\" ves lo que está sin stock o en su mínimo.",
      "En el \"Historial de movimientos\" queda cada cambio, con quién y cuándo.",
    ],
    pasos: [
      {
        titulo: "Ingreso de mercadería",
        texto:
          "En \"Ingreso rápido\" escaneá el código con el lector o escribí el nombre del producto, poné la cantidad que entra y confirmá. Se suma al stock y queda registrado.",
      },
      {
        titulo: "Ajustar stock",
        texto:
          "Tocá \"Ajustar stock\" (en esta pantalla o en el producto) y elegí el motivo: \"Venta en el local\", \"Rotura\", \"Devolución\" o \"Corrección (conteo)\". En la corrección escribís lo que hay de verdad y el sistema calcula la diferencia.",
      },
      {
        titulo: "Para reponer",
        texto:
          "Muestra las variantes sin stock (en rojo) o con stock bajo (en ámbar). \"Stock bajo\" significa que llegó al \"Stock mínimo\" que pusieron en el producto.",
      },
      {
        titulo: "Historial",
        texto:
          "Cada entrada y salida queda anotada con el motivo, la nota, quién la hizo y la fecha. Podés filtrar por producto, motivo o fechas.",
      },
    ],
  },

  apariencia: {
    id: "apariencia",
    feature: "appearance", // hoy solo el desarrollador
    titulo: "Apariencia de la tienda",
    resumen: "La barra de anuncios de arriba de todo y los banners grandes del inicio (hasta 3, en carrusel).",
    pasosRapidos: [
      "Barra de anuncios: escribí hasta 4 mensajes cortos y tocá \"Guardar mensajes\".",
      "Banner: tocá \"Nuevo banner\" y elegí \"Plantilla\" (armado con la marca) o \"Imagen completa\" (diseñada aparte). Podés tener hasta 3.",
      "Con 2 o 3 activos, en la tienda pasan solos cada 6 segundos. Ordenalos con las flechas de la lista.",
      "Si el banner es para una fecha (Navidad, Día de la Madre…), poné \"Desde\" y \"Hasta\": se prende y se apaga solo.",
      "Si no hay ningún banner activo, la tienda muestra el de Home Deko.",
    ],
    pasos: [
      {
        titulo: "Barra de anuncios",
        texto:
          "Es la franja roja fina de arriba de todo en la tienda. Escribí hasta 4 mensajes (de hasta 120 caracteres cada uno), ordenalos con las flechas y tocá \"Guardar mensajes\". Con 1 mensaje queda fijo y centrado; con 2 o más, corren uno detrás del otro (se frenan al pasar el mouse). Si la persona tiene activado \"reducir movimiento\" en su celular o compu, en vez de correr van cambiando cada 4 segundos. Sin mensajes, la barra no se muestra.",
      },
      {
        titulo: "Plantilla de marca",
        texto:
          "Es la forma más rápida: escribís un título, un texto corto, el botón (por ejemplo \"Ver ofertas\" que lleve a /productos) y elegís una foto de producto. Elegí el fondo \"Rojo\" (con el logo en blanco) o \"Blanco\" (con el botón en rojo). La vista previa muestra cómo queda en el celular y en la PC.",
      },
      {
        titulo: "Imagen completa",
        texto:
          "Si el banner lo diseñan aparte (por ejemplo en Canva), subí la imagen para PC de 1920 × 800 px (va de borde a borde de la pantalla) y, si querés, otra para celular de 1080 × 1350 px (si no, se usa la de PC). Con 2 o 3 banners conviene subir siempre la de celular: si falta, la de PC se recorta para que tenga el mismo alto que los demás. Dejá los textos importantes lejos de los bordes: en pantallas distintas se puede recortar un poco. Escribí una descripción corta de la imagen: la usan quienes navegan con lector de pantalla. Si ponés un link, toda la imagen se puede tocar.",
      },
      {
        titulo: "Varios banners (carrusel)",
        texto:
          "Podés tener hasta 3 banners. Si hay 2 o 3 activos y en fecha, en la tienda se muestran en carrusel: pasan solos cada 6 segundos, con flechas en la PC, deslizando con el dedo en el celular y con puntitos abajo para elegir uno. Se frena al pasar el mouse o al tocarlo, y tiene un botón para pausarlo. Si la persona tiene activado \"reducir movimiento\" en su celular o compu, no pasa solo. El orden es el de la lista: usá las flechas ↑ ↓ de cada banner para subirlo o bajarlo. Con 3 banners ya no aparece \"Nuevo banner\": eliminá uno para agregar otro.",
      },
      {
        titulo: "Link del botón",
        texto:
          "Para una página de la tienda escribí la dirección que empieza con / (por ejemplo /productos o /categorias/cocina). Para otro sitio, pegá el link completo (https://…): se abre en otra pestaña.",
      },
      {
        titulo: "Fechas: se prende y se apaga solo",
        texto:
          "\"Desde\" y \"Hasta\" son opcionales. Con fechas, el banner aparece a las 0 h del primer día y se apaga al terminar el último. Pueden dejar varios programados: los que coinciden en fecha se ven juntos, en carrusel. En la lista, cada banner dice si \"Se ve ahora\", está \"Programado\", \"Terminado\" o \"Pausado\".",
      },
      {
        titulo: "Pausar o eliminar",
        texto:
          "Apagá \"Activo\" para sacarlo de la tienda sin borrarlo (lo volvés a prender cuando quieras). \"Eliminar\" lo borra definitivamente, junto con sus imágenes. Si no queda ninguno activo, la tienda muestra el banner de Home Deko por defecto.",
      },
    ],
  },

  configuracion: {
    id: "configuracion",
    titulo: "Configuración",
    resumen: "Los datos del comercio, las redes, el envío y el interruptor para lanzar la tienda.",
    pasosRapidos: [
      "Completá los \"Datos del comercio\": nombre o razón social, CUIT y email de contacto.",
      "Cargá WhatsApp, Instagram y TikTok, el costo del envío, el plazo de despacho, la dirección y horarios del local y el plazo para cambios.",
      "Tocá \"Guardar cambios\": se ven al instante en la tienda, el pie, las páginas de ayuda y las legales.",
      "El día del lanzamiento, prendé \"Tienda lanzada\" y confirmá (antes tienen que estar los datos del comercio y el WhatsApp).",
    ],
    pasos: [
      {
        titulo: "Datos del comercio",
        texto:
          "El nombre o razón social, el CUIT y el email de contacto aparecen en el pie de la tienda y en las páginas de Privacidad y Términos (la ley pide que estén a la vista). Mientras falte alguno, en Privacidad y Términos se ve \"[COMPLETAR]\" resaltado en amarillo (en el pie, simplemente no aparece).",
      },
      {
        titulo: "Redes y WhatsApp",
        texto:
          "Para Instagram y TikTok escribí solo el usuario (o pegá el link del perfil y se arregla solo). El WhatsApp va con código de país y sin el 0 ni el 15: por ejemplo 5492945123456. Si dejás una red vacía, no se muestra.",
      },
      {
        titulo: "Envío y retiro",
        texto:
          "El costo del envío a domicilio es un precio fijo para todo el país. La dirección y los horarios del local se le muestran a quien elige retirar su compra (el retiro es gratis).",
      },
      {
        titulo: "Plazo de despacho",
        texto:
          "Cuánto tardan en despachar un pedido ya pagado, escrito como lo dirían ustedes: por ejemplo \"24 a 48 h hábiles\". Aparece como \"Despachamos tu pedido en 24 a 48 h hábiles\" en Cómo comprar, Envíos, Preguntas frecuentes, los Términos y el mail de pago confirmado. Si lo dejás vacío, esa frase no aparece.",
      },
      {
        titulo: "Páginas de ayuda de la tienda",
        texto:
          "Cómo comprar, Envíos y retiro, Cambios y devoluciones, Preguntas frecuentes y Contacto toman estos datos solos: si cambiás el costo del envío, los días de cambio o los horarios, se actualizan al guardar. Lo que no está cargado simplemente no aparece (los clientes nunca ven \"[COMPLETAR]\"). Si querés cambiar algún texto de esas páginas, pedíselo a Leo.",
      },
      {
        titulo: "Cambios por gusto",
        texto:
          "En \"Cambios por gusto: plazo en días\" ponés cuántos días tiene un cliente para cambiar un producto sin falla (por defecto 30). Si ponés 0, los Términos dicen que no se aceptan cambios por gusto. El derecho de arrepentimiento (10 días) y la garantía por productos fallados aparecen siempre, porque son obligatorios por ley.",
      },
      {
        titulo: "Tienda lanzada (modo construcción)",
        texto:
          "Mientras \"Tienda lanzada\" está apagado, los visitantes ven la página \"Muy pronto\" y los buscadores no muestran la tienda. Ustedes, con la sesión iniciada, ven la tienda tal como va quedando, con una barra arriba que dice \"Vista previa\". El día del lanzamiento prendé el interruptor y confirmá: desde ese momento todos ven la tienda y pueden comprar. Si hace falta, se puede volver a apagar.",
      },
      {
        titulo: "Qué hace falta para lanzar",
        texto:
          "Para prender \"Tienda lanzada\" tienen que estar guardados el nombre o razón social, el CUIT, el email de contacto y el WhatsApp. Mientras falte alguno, el interruptor no se puede prender y arriba aparece un aviso en amarillo con lo que falta: tocá cada uno para ir directo al campo, completalo y tocá \"Guardar cambios\". Con la tienda ya lanzada, esos datos se pueden cambiar pero no dejar vacíos.",
      },
      {
        titulo: "Banner y barra de anuncios",
        texto:
          "Los banners grandes del inicio (pueden ser hasta 3, que pasan solos) y los mensajes de la barra roja de arriba de todo los actualiza Leo. Pedíselos por WhatsApp (botón \"WhatsApp\" en la Ayuda) con el texto, las fechas y la imagen si la tenés.",
      },
      {
        titulo: "Ver como cliente",
        texto:
          "Con la sesión iniciada, en la tienda aparece una barra negra arriba (los clientes no la ven). Ahí, \"Ver como cliente\" oculta los productos en Borrador y los avisos para ustedes, y muestra la tienda exactamente como la ve un visitante. Para volver, tocá \"Volver a la vista de admin\".",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Preguntas frecuentes
// ---------------------------------------------------------------------------

export const PREGUNTAS_FRECUENTES: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: "¿Cómo se cuentan las visitas? ¿Se guardan datos de los clientes?",
    respuesta:
      "No. La tienda suma uno a un contador por día y por origen (Instagram, Google, directo…), sin cookies y sin guardar nada de la persona: ni IP, ni nombre, ni dispositivo. No se cuentan ustedes (con la sesión del panel iniciada) ni los robots de los buscadores. Por eso los números son aproximados, como en cualquier estadística de visitas.",
  },
  {
    pregunta: "¿Cómo hago para que las visitas de Instagram o WhatsApp se cuenten bien?",
    respuesta:
      "Agregá al final del link ?utm_source= y el nombre de la red. Por ejemplo, en la bio de Instagram: www.homedekotrevelin.com/?utm_source=instagram; en un mensaje de WhatsApp: www.homedekotrevelin.com/?utm_source=whatsapp. WhatsApp casi nunca avisa de dónde viene la persona, así que sin eso esas visitas aparecen como \"Directo\".",
  },
  {
    pregunta: "¿Por qué las ventas del Inicio no coinciden con lo que veo en Mercado Pago?",
    respuesta:
      "El Inicio cuenta cada venta el día en que se aprobó el pago, en hora de Argentina, con el envío incluido y sin los pedidos cancelados. Mercado Pago muestra todo lo que cobró, también lo que después se devolvió, y le descuenta sus comisiones.",
  },
  {
    pregunta: "Un pedido dice \"Pagado sin stock\". ¿Qué hago?",
    respuesta:
      "Dos clientes pagaron la última unidad casi al mismo tiempo y para el segundo ya no alcanzó. Escribile (sus datos están en el pedido) y ofrecele otro producto o devolvele el dinero desde tu cuenta de Mercado Pago: Actividad → el pago → Devolver.",
  },
  {
    pregunta: "Un pedido dice \"Para revisar\". ¿Qué significa?",
    respuesta:
      "Que hay un detalle a verificar antes de prepararlo; el motivo aparece debajo del aviso (por ejemplo, que el monto cobrado no coincide con el pedido o que el pago se devolvió). El stock no se descuenta solo en esos casos. Si tenés dudas, escribile a Leo.",
  },
  {
    pregunta: "Llegó una solicitud de arrepentimiento. ¿Qué hago?",
    respuesta:
      "El cliente ya tiene su código: no hace falta mandárselo. Entrá a Arrepentimientos, abrí la solicitud y escribile para coordinar la devolución (los gastos de envío de la devolución los paga la tienda). Cuando vuelva el producto, devolvé el dinero desde Mercado Pago y marcala \"Resuelta\". Si pasaron más de 10 días desde que recibió el producto, explicáselo y marcala \"No corresponde\" con una nota.",
  },
  {
    pregunta: "¿Por qué hay un \"Botón de arrepentimiento\" en la tienda?",
    respuesta:
      "Porque es obligatorio para todas las tiendas online de Argentina (Disposición 954/2025): tiene que verse a simple vista desde la primera página y permitir arrepentirse sin registrarse. Por eso está en el pie de todas las páginas, en el menú y arriba en la computadora. No se puede sacar.",
  },
  {
    pregunta: "Un cupón dice \"1 uso entró por encima del límite\". ¿Qué pasó?",
    respuesta:
      "Dos clientes pagaron casi al mismo tiempo con el último uso que quedaba. Como los dos ya habían pagado con el descuento, se les respetó a ambos y quedó anotado. No hay que hacer nada: pasa muy rara vez.",
  },
  {
    pregunta: "¿Un cupón se puede sumar al descuento de un producto?",
    respuesta:
      "No: nunca se suman. La tienda aplica el que más le conviene al cliente en cada producto. Si un producto ya tiene un descuento mejor que el cupón, se queda con el suyo.",
  },
  {
    pregunta: "¿Cómo veo la tienda como la ve un cliente?",
    respuesta:
      "En la tienda, tocá \"Ver como cliente\" en la barra negra de arriba: se ocultan los productos en Borrador y los avisos para ustedes. Si la tienda todavía no está lanzada, los visitantes en realidad ven la página \"Muy pronto\": para comprobarlo, abrí el sitio en una ventana de incógnito (o desde un celular donde no hayas iniciado sesión).",
  },
  {
    pregunta: "¿Desde dónde entro al panel?",
    respuesta:
      "Desde homedekotrevelin.com/admin/login (guardalo en favoritos). Si ya iniciaste sesión, el botón \"Panel\" de arriba de la tienda te lleva directo. El \"Ingresá\" de la tienda es para los clientes: aunque un cliente cree una cuenta, nunca puede entrar al panel.",
  },
  {
    pregunta: "¿Los clientes pueden tener una cuenta?",
    respuesta:
      "Sí, es opcional: entran desde \"Ingresá\" en la tienda, con Google o con su email y un código que les llega por mail (sin contraseñas). Ven sus pedidos y su estado, guardan su dirección y pueden eliminar su cuenta. Si eliminan la cuenta, sus pedidos siguen en Pedidos, con los datos de la compra: no hay que hacer nada.",
  },
  {
    pregunta: "¿Cómo cambio el banner del inicio o los mensajes de la barra de arriba?",
    respuesta:
      "Los actualiza Leo: pedíselos por WhatsApp (botón \"WhatsApp\" arriba de esta página). Para el banner, contale qué querés mostrar y desde qué día hasta qué día, por ejemplo una promo de Navidad del 1 al 25 de diciembre, y mandale la foto o la imagen si ya la tenés: queda programado y se prende y se apaga solo en esas fechas. Puede haber hasta 3 banners a la vez: pasan solos uno detrás del otro, en el orden que le pidas. Para la barra roja de arriba de todo, pasale los mensajes (hasta 4 cortos, por ejemplo \"Envíos a todo el país\" o un aviso de feriado).",
  },
  {
    pregunta: "¿Qué productos aparecen en \"Destacados\" del inicio?",
    respuesta:
      "Los productos publicados que tienen activado \"Destacado\" (hasta 8, los más nuevos primero). Si no hay ninguno, esa sección no se muestra a los clientes.",
  },
  {
    pregunta: "¿Por qué no puedo cambiar el stock desde el formulario del producto?",
    respuesta:
      "Para que siempre quede registrado por qué cambió. Usá \"Ajustar stock\" o el \"Ingreso rápido\": así cada movimiento tiene su motivo y aparece en el historial.",
  },
  {
    pregunta: "¿Qué diferencia hay entre Borrador, Publicado y Archivado?",
    respuesta:
      "Borrador: lo estás cargando y no se ve en la tienda. Publicado: se ve y se puede comprar. Archivado: ya no lo venden; no se ve en la tienda, pero se guarda con todo su historial.",
  },
  {
    pregunta: "¿Puedo borrar un producto?",
    respuesta:
      "Los productos no se borran, se archivan. Así no se pierden las ventas ni los movimientos de stock. Si lo archivaste por error, abrilo y cambiale el estado.",
  },
  {
    pregunta: "No me deja eliminar una categoría, ¿por qué?",
    respuesta:
      "Porque todavía tiene productos. Para que no se vea en la tienda, editala y apagá \"Visible\". Si igual querés eliminarla, primero pasá sus productos a otra categoría.",
  },
  {
    pregunta: "¿El código de barras cambia si edito el producto?",
    respuesta:
      "No. Cada variante recibe su código automáticamente al crearse y nunca cambia. Por eso las etiquetas que ya pegaste siguen sirviendo.",
  },
  {
    pregunta: "¿Por qué la etiqueta no tiene el precio?",
    respuesta:
      "A propósito: el precio se consulta en el sistema al escanear. Así, si cambia el precio, no hay que volver a imprimir las etiquetas.",
  },
  {
    pregunta: "¿Cómo uso el lector de códigos de barras?",
    respuesta:
      "Hacé clic en cualquier buscador del panel (por ejemplo en Productos o en \"Ingreso rápido\") y escaneá. El lector escribe el código y aprieta Enter solo.",
  },
  {
    pregunta: "¿Qué es el stock mínimo?",
    respuesta:
      "Es la cantidad a partir de la cual el panel avisa que hay que reponer. Si ponés 3, cuando queden 3 o menos aparece en \"Para reponer\" y en el contador del menú Stock.",
  },
  {
    pregunta: "Me sobró media hoja de etiquetas, ¿la puedo usar?",
    respuesta:
      "Sí. En Etiquetas, en \"Empezar en la posición\", tocá el primer lugar libre de la hoja. Las anteriores quedan en blanco.",
  },
  {
    pregunta: "Cargué algo mal, ¿cómo lo arreglo?",
    respuesta:
      "Abrí el producto, corregí y tocá \"Guardar cambios\". Si fue un error de stock, hacé un \"Ajustar stock\" con el motivo \"Corrección (conteo)\". Si no sabés cómo seguir, escribinos por WhatsApp.",
  },
];
