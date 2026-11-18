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

export type GuiaId = "productos" | "categorias" | "etiquetas" | "stock" | "configuracion";

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
};

export const GUIAS: Record<GuiaId, Guia> = {
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
          "\"Borrador\" no se ve en la tienda. \"Publicado\" se ve y se puede comprar. Desde el listado podés seleccionar varios productos y publicarlos, ocultarlos, cambiarles la categoría o archivarlos de una vez.",
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
          "En el menú de cada fila elegí \"Editar\" o \"Eliminar\". Solo se puede eliminar una categoría vacía: si tiene productos, editala y apagá \"Visible\" para que no aparezca en la tienda.",
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

  configuracion: {
    id: "configuracion",
    titulo: "Configuración",
    resumen: "Los datos del comercio, las redes, el envío y el interruptor para lanzar la tienda.",
    pasosRapidos: [
      "Completá los \"Datos del comercio\": nombre o razón social, CUIT y email de contacto.",
      "Cargá WhatsApp, Instagram y TikTok, el costo del envío, la dirección y horarios del local y el plazo para cambios.",
      "Tocá \"Guardar cambios\": se ven al instante en la tienda, el pie y las páginas legales.",
      "El día del lanzamiento, prendé \"Tienda lanzada\" y confirmá.",
    ],
    pasos: [
      {
        titulo: "Datos del comercio",
        texto:
          "El nombre o razón social, el CUIT y el email de contacto aparecen en el pie de la tienda y en las páginas de Privacidad y Términos (la ley pide que estén a la vista). Mientras falte alguno, en esas páginas se ve \"[COMPLETAR]\" resaltado en amarillo.",
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
        titulo: "Cambios por gusto",
        texto:
          "En \"Cambios por gusto: plazo en días\" ponés cuántos días tiene un cliente para cambiar un producto sin falla (por defecto 30). Si ponés 0, los Términos dicen que no se aceptan cambios por gusto. El derecho de arrepentimiento (10 días) y la garantía por productos fallados aparecen siempre, porque son obligatorios por ley.",
      },
      {
        titulo: "Tienda lanzada (modo construcción)",
        texto:
          "Mientras \"Tienda lanzada\" está apagado, los visitantes ven la página \"Muy pronto\" y los buscadores no muestran la tienda. Ustedes, con la sesión iniciada, ven la tienda tal como va quedando, con una barra arriba que dice \"Vista previa\". El día del lanzamiento prendé el interruptor y confirmá: desde ese momento todos ven la tienda y pueden comprar. Si hace falta, se puede volver a apagar.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Preguntas frecuentes
// ---------------------------------------------------------------------------

export const PREGUNTAS_FRECUENTES: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: "¿Cómo veo la tienda como la ve un cliente?",
    respuesta:
      "Abrí el sitio en una ventana de incógnito (o desde un celular donde no hayas iniciado sesión). Si la tienda no está lanzada, vas a ver la página \"Muy pronto\", que es lo que ven los visitantes.",
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
