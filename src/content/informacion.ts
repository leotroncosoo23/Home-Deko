import type { DatosTienda } from "@/lib/store-settings";

/**
 * Textos de las PÁGINAS DE INFORMACIÓN de la tienda (para clientes):
 *   /como-comprar            → comoComprar(D)
 *   /envios                  → envios(D)
 *   /cambios-y-devoluciones  → cambios(D)
 *   /preguntas-frecuentes    → preguntasFrecuentes(D)
 *   /contacto                → contacto(D)
 *   /arrepentimiento         → arrepentimiento(D)
 *
 * Para cambiar un texto, editalo acá: no hace falta tocar ningún componente.
 *
 * Los DATOS (costo de envío, plazo de despacho, dirección, horarios, días de
 * cambio, WhatsApp, email, redes) llegan como `D` desde Configuración del panel
 * (ver datosTienda() en src/lib/store-settings.ts) y se actualizan solos.
 * Lo que NO está cargado llega como null: la frase que lo usa se escribe con
 * `D.dato && "…"` y, si queda en null/false, NO aparece (nunca "[COMPLETAR]").
 *
 * Links dentro del texto: [texto](/ruta) → se dibuja como link.
 *
 * Regla del negocio: el transporte todavía no está definido. NO nombrar
 * ninguna empresa (Correo Argentino u otra) en estos textos.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Un texto que puede omitirse (null/false = no se muestra). */
export type Texto = string | null | false;

/** Párrafo, o lista con viñetas. */
export type BloqueInfo = Texto | { lista: Texto[] };

/** Ícono de la sección (el componente lo traduce a un ícono de lucide). */
export type IconoInfo =
  | "truck"
  | "store"
  | "package"
  | "clock"
  | "refresh"
  | "shield"
  | "undo"
  | "card"
  | "user"
  | "tag"
  | "mail"
  | "help";

export type SeccionInfo = {
  /** Ancla en la URL (/envios#retiro). */
  id: string;
  titulo: string;
  icono?: IconoInfo;
  bloques: BloqueInfo[];
};

export type PaginaInfo = {
  /** <title> y <h1>. */
  titulo: string;
  /** Meta descripción (Google y redes): una o dos frases. */
  descripcion: string;
  /** Texto debajo del título. */
  intro: string;
  secciones: SeccionInfo[];
};

export type Paso = { titulo: string; texto: Texto[] };
export type Pregunta = { pregunta: string; respuesta: Texto[] };

// ---------------------------------------------------------------------------
// Frases que se repiten
// ---------------------------------------------------------------------------

const ARREPENTIMIENTO = "/arrepentimiento";

/** "$ 20.000, precio fijo a cualquier lugar del país" (o gratis si el costo es 0). */
function costoEnvio(D: DatosTienda) {
  return D.envio ? `${D.envio}, precio fijo a cualquier lugar del país` : "gratis, a cualquier lugar del país";
}

/** "Despachamos tu pedido en 24 a 48 h hábiles desde que se aprueba el pago." o false. */
function plazoDespacho(D: DatosTienda): Texto {
  return D.despacho && `Despachamos tu pedido en ${D.despacho} desde que se aprueba el pago.`;
}

/**
 * "Escribinos por WhatsApp o por email a hola@…" según lo cargado; si no hay
 * nada, la página de Contacto. `inicio` = "escribinos" para usarla a mitad de frase.
 */
function escribinos(D: DatosTienda, inicio = "Escribinos") {
  const canales = [
    D.whatsapp && `[por WhatsApp](${D.whatsapp.href})`,
    D.email && `por email a [${D.email}](mailto:${D.email})`,
  ].filter(Boolean);
  return canales.length > 0 ? `${inicio} ${canales.join(" o ")}` : `${inicio} desde [Contacto](/contacto)`;
}

/** 1 → "1 día corrido", 30 → "30 días corridos". */
function diasCorridos(dias: number) {
  return dias === 1 ? "1 día corrido" : `${dias} días corridos`;
}

// ---------------------------------------------------------------------------
// Cómo comprar
// ---------------------------------------------------------------------------

export function comoComprar(D: DatosTienda): PaginaInfo & { pasos: Paso[] } {
  return {
    titulo: "Cómo comprar",
    descripcion:
      "Comprá en Home Deko en pocos pasos: elegí tus productos, completá tus datos y pagá con Mercado Pago. Envío a todo el país o retiro gratis en el local.",
    intro: "Comprar en Home Deko es fácil y seguro. Te contamos el paso a paso.",
    pasos: [
      {
        titulo: "Elegí tus productos",
        texto: [
          "Recorré el [catálogo](/productos) o buscá lo que necesitás. Si el producto tiene opciones (color, medida…), elegí la que más te guste y tocá «Agregar al carrito».",
        ],
      },
      {
        titulo: "Revisá tu carrito",
        texto: ["Cuando tengas todo, abrí el carrito y tocá «Iniciar compra». Podés cambiar las cantidades o sacar productos."],
      },
      {
        titulo: "Completá tus datos y la entrega",
        texto: [
          "Dejanos tu nombre, email y teléfono, y elegí si querés envío a domicilio o retirar gratis en el local.",
          "No necesitás crear una cuenta. Si querés, podés [ingresar](/mi-cuenta) con Google o con un código que te mandamos por email: completamos tus datos solos y ves todos tus pedidos en un lugar.",
        ],
      },
      {
        titulo: "¿Tenés un cupón?",
        texto: ["En el resumen de tu pedido tocá «¿Tenés un cupón?», escribí el código y aplicalo. El descuento se ve en el total antes de pagar."],
      },
      {
        titulo: "Pagá con Mercado Pago",
        texto: [
          "Tocá «Pagar con Mercado Pago» y elegí cómo pagar: tarjeta de crédito o débito, o dinero en tu cuenta. Las cuotas disponibles las muestra Mercado Pago.",
        ],
      },
      {
        titulo: "¡Listo!",
        texto: [
          "Cuando se aprueba el pago te mandamos un email con el detalle y el link para seguir tu pedido.",
          plazoDespacho(D),
          "Si elegiste envío, te avisamos con el código de seguimiento cuando lo despachamos. Si elegiste retiro, te avisamos cuando está listo para que pases a buscarlo.",
        ],
      },
    ],
    secciones: [
      {
        id: "pagos",
        titulo: "Pagos seguros",
        icono: "shield",
        bloques: [
          "Todos los pagos se hacen con Mercado Pago: nosotros nunca vemos ni guardamos los datos de tu tarjeta.",
          "No aceptamos pagos en efectivo por Rapipago o Pago Fácil. Si tenés dudas con un pago, [escribinos](/contacto).",
        ],
      },
      {
        id: "ayuda",
        titulo: "¿Necesitás ayuda?",
        icono: "help",
        bloques: [
          `Mirá las [preguntas frecuentes](/preguntas-frecuentes) o ${escribinos(D, "escribinos")}: te ayudamos a elegir y a completar tu compra.`,
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Envíos y retiro
// ---------------------------------------------------------------------------

export function envios(D: DatosTienda): PaginaInfo {
  return {
    titulo: "Envíos y retiro",
    descripcion: D.envio
      ? `Envío a domicilio a todo el país por ${D.envio} fijo, o retiro gratis en el local de Home Deko.`
      : "Envío a domicilio a todo el país o retiro gratis en el local de Home Deko.",
    intro: "Elegí cómo recibir tu compra: te la mandamos a cualquier lugar del país o la pasás a buscar por el local.",
    secciones: [
      {
        id: "envio",
        titulo: "Envío a domicilio",
        icono: "truck",
        bloques: [
          `El envío cuesta ${costoEnvio(D)}, sin importar cuántos productos compres.`,
          plazoDespacho(D),
          "El tiempo de entrega depende de la zona. Cuando despachamos tu pedido te mandamos un email con el código de seguimiento.",
          "Revisá bien la dirección al comprar: podés sumar piso, departamento e indicaciones para quien entrega.",
        ],
      },
      {
        id: "seguimiento",
        titulo: "Seguimiento de tu pedido",
        icono: "package",
        bloques: [
          {
            lista: [
              "En el email de confirmación tenés el link para ver el estado de tu pedido en todo momento.",
              "Cuando lo despachamos, te llega otro email con la empresa y el código para seguirlo.",
              "Si ingresaste con tu cuenta, también lo ves en [Mis pedidos](/mi-cuenta).",
            ],
          },
        ],
      },
      {
        id: "retiro",
        titulo: "Retiro en el local (gratis)",
        icono: "store",
        bloques: [
          "Elegí «Retiro en el local» al comprar y no pagás envío. Te avisamos por email cuando tu pedido está listo.",
          D.direccion && `Dirección: ${D.direccion}.`,
          D.horarios && `Horarios: ${D.horarios}.`,
          "Para retirar, decinos tu nombre o el número de pedido. Si va otra persona, avisanos antes.",
          D.direccion && "[Ver cómo llegar](/contacto#local)",
        ],
      },
      {
        id: "recepcion",
        titulo: "Al recibir tu paquete",
        icono: "shield",
        bloques: [
          "Revisalo cuando llegue. Si algo vino dañado o falta un producto, avisanos dentro de las 48 horas con fotos y lo resolvemos.",
          "Si el envío vuelve porque la dirección estaba incompleta o nadie lo recibió, coordinamos con vos un nuevo envío, que puede tener un nuevo costo.",
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Cambios y devoluciones
// ---------------------------------------------------------------------------

export function cambios(D: DatosTienda): PaginaInfo {
  const porGusto = D.cambiosDias > 0;
  return {
    titulo: "Cambios y devoluciones",
    descripcion: porGusto
      ? `Tenés ${diasCorridos(D.cambiosDias)} para cambiar tu compra en Home Deko. Conocé cómo hacer un cambio, una devolución o arrepentirte de una compra.`
      : "Conocé cómo hacer un cambio por falla, una devolución o arrepentirte de una compra en Home Deko.",
    intro: "Queremos que estés feliz con tu compra. Si algo no es lo que esperabas, lo resolvemos juntos.",
    secciones: [
      {
        id: "por-gusto",
        titulo: "Cambios por gusto",
        icono: "refresh",
        bloques: porGusto
          ? [
              `¿No te convenció el color o la medida? Tenés ${diasCorridos(D.cambiosDias)} desde que recibís el producto para cambiarlo por otro.`,
              {
                lista: [
                  "Tiene que estar sin uso, en perfecto estado y con su embalaje original.",
                  "Podés hacer el cambio en el local o por envío. Si no es por una falla, el costo del envío corre por tu cuenta.",
                ],
              },
            ]
          : [
              "Por ahora no hacemos cambios de productos sin falla. Esto no afecta tu derecho de arrepentimiento ni la garantía por productos fallados, que se mantienen siempre.",
            ],
      },
      {
        id: "falla",
        titulo: "Productos con falla",
        icono: "shield",
        bloques: [
          "Si un producto llegó fallado o con un defecto, lo cambiamos o te devolvemos el dinero, sin costo para vos (garantía legal de la Ley 24.240 de Defensa del Consumidor).",
          "Si llegó dañado por el envío, avisanos dentro de las 48 horas con fotos.",
        ],
      },
      {
        id: "arrepentimiento",
        titulo: "Arrepentimiento de compra",
        icono: "undo",
        bloques: [
          "Si compraste en la tienda online, tenés 10 días corridos desde que recibiste el producto para arrepentirte, sin dar explicaciones y sin ningún costo. Te devolvemos el total pagado, incluido el envío.",
          `Hacelo desde el [Botón de arrepentimiento](${ARREPENTIMIENTO}): no necesitás cuenta y recibís un código de tu solicitud al instante.`,
        ],
      },
      {
        id: "como",
        titulo: "Cómo pedir un cambio o una devolución",
        icono: "mail",
        bloques: [
          `${escribinos(D)} con tu número de pedido y contanos qué pasó. Te respondemos para coordinar todo.`,
          "El dinero de una devolución se reintegra por el mismo medio de pago, en los plazos de Mercado Pago y de tu banco.",
          "Más detalles en los [Términos y condiciones](/terminos#cambios).",
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Preguntas frecuentes
// ---------------------------------------------------------------------------

export function preguntasFrecuentes(D: DatosTienda): {
  titulo: string;
  descripcion: string;
  intro: string;
  preguntas: Pregunta[];
} {
  const preguntas: Pregunta[] = [
    {
      pregunta: "¿Necesito crear una cuenta para comprar?",
      respuesta: [
        "No. Podés comprar solo con tu nombre, email y teléfono. Si querés, podés [ingresar](/mi-cuenta) con Google o con un código por email para ver todos tus pedidos en un lugar.",
      ],
    },
    {
      pregunta: "¿Qué medios de pago aceptan?",
      respuesta: [
        "Pagás con Mercado Pago: tarjeta de crédito, débito o dinero en tu cuenta. Las cuotas disponibles las muestra Mercado Pago al pagar. No aceptamos efectivo por Rapipago o Pago Fácil.",
      ],
    },
    {
      pregunta: "¿Es seguro pagar en la tienda?",
      respuesta: [
        "Sí. El pago se hace en Mercado Pago: nosotros nunca vemos ni guardamos los datos de tu tarjeta.",
      ],
    },
    {
      pregunta: "¿Cuánto cuesta el envío?",
      respuesta: [`El envío a domicilio cuesta ${costoEnvio(D)}. Retirar en el local es gratis.`],
    },
    {
      pregunta: "¿Cuánto tarda en llegar mi pedido?",
      respuesta: [
        plazoDespacho(D),
        "Desde que lo despachamos, el tiempo de entrega depende de tu zona. Te mandamos el código de seguimiento por email para que sepas dónde está.",
      ],
    },
    {
      pregunta: "¿Cómo sigo mi pedido?",
      respuesta: [
        "Con el link del email de confirmación ves el estado en todo momento. Cuando lo despachamos te llega el código de seguimiento. Si ingresaste con tu cuenta, lo ves en [Mis pedidos](/mi-cuenta).",
      ],
    },
    {
      pregunta: "¿Puedo retirar mi compra en el local?",
      respuesta: [
        "Sí, y es gratis. Elegí «Retiro en el local» al comprar y te avisamos por email cuando está listo.",
        D.direccion && `Estamos en ${D.direccion}.`,
        D.horarios && `Horarios: ${D.horarios}.`,
      ],
    },
    {
      pregunta: "¿Cómo uso un cupón de descuento?",
      respuesta: [
        "Al finalizar la compra, en el resumen de tu pedido tocá «¿Tenés un cupón?», escribí el código y aplicalo. Los descuentos no se suman: siempre pagás el mejor precio.",
      ],
    },
    {
      pregunta: "¿Puedo cambiar un producto?",
      respuesta: [
        D.cambiosDias > 0
          ? `Sí. Tenés ${diasCorridos(D.cambiosDias)} desde que lo recibís para cambiarlo, sin uso y con su embalaje. Mirá [Cambios y devoluciones](/cambios-y-devoluciones).`
          : "Por ahora no hacemos cambios por gusto, pero si el producto tiene una falla lo cambiamos o te devolvemos el dinero. Mirá [Cambios y devoluciones](/cambios-y-devoluciones).",
      ],
    },
    {
      pregunta: "Me llegó un producto dañado, ¿qué hago?",
      respuesta: [`${escribinos(D)} dentro de las 48 horas con fotos del producto y del paquete, y lo resolvemos.`],
    },
    {
      pregunta: "¿Cómo me arrepiento de una compra?",
      respuesta: [
        `Tenés 10 días corridos desde que recibiste el producto. Usá el [Botón de arrepentimiento](${ARREPENTIMIENTO}): no necesitás cuenta, recibís un código de solicitud al instante y te devolvemos el total pagado.`,
      ],
    },
    {
      pregunta: "No me llegó el email de confirmación",
      respuesta: [
        `Revisá la carpeta de spam o promociones. Si no está, ${escribinos(D, "escribinos")} con tu nombre y te reenviamos el link de tu pedido.`,
      ],
    },
  ];

  return {
    titulo: "Preguntas frecuentes",
    descripcion: "Respuestas sobre compras, pagos con Mercado Pago, envíos, retiro en el local, cupones, cambios y devoluciones en Home Deko.",
    intro: "Las dudas más comunes, en un solo lugar. Si no encontrás lo que buscás, escribinos.",
    preguntas,
  };
}

// ---------------------------------------------------------------------------
// Contacto
// ---------------------------------------------------------------------------

export function contacto(D: DatosTienda) {
  return {
    titulo: "Contacto",
    descripcion: D.direccion
      ? `Escribinos o visitanos en el local de Home Deko: ${D.direccion}.`
      : "Escribinos por WhatsApp, redes o email. Te respondemos a la brevedad.",
    intro: "¿Tenés una consulta sobre un producto o tu pedido? Escribinos por donde te quede más cómodo: te respondemos a la brevedad.",
    whatsappTexto: "La forma más rápida de consultarnos.",
    emailTexto: "Para consultas, cambios y devoluciones.",
    redesTexto: "Novedades, ideas y productos nuevos.",
    localTitulo: "Visitanos en el local",
  };
}

// ---------------------------------------------------------------------------
// Botón de arrepentimiento
// ---------------------------------------------------------------------------

export function arrepentimiento(D: DatosTienda): PaginaInfo {
  return {
    titulo: "Botón de arrepentimiento",
    descripcion:
      "Si compraste en la tienda online de Home Deko, podés arrepentirte dentro de los 10 días corridos, sin costo y sin registrarte.",
    intro:
      "Si compraste en nuestra tienda online, tenés 10 días corridos desde que recibiste el producto para arrepentirte, sin dar explicaciones y sin ningún costo.",
    secciones: [
      {
        id: "como-funciona",
        titulo: "Cómo funciona",
        icono: "undo",
        bloques: [
          {
            lista: [
              "Completá el formulario: no necesitás cuenta ni registrarte.",
              "Al enviarlo te mostramos un código de solicitud y te lo mandamos por email. Guardalo: identifica tu pedido de arrepentimiento.",
              "Te escribimos para coordinar la devolución del producto. Los gastos de devolución corren por nuestra cuenta.",
              "El producto tiene que volver en el mismo estado en que lo recibiste.",
              "Te devolvemos el total pagado, incluido el envío, por el mismo medio de pago.",
            ],
          },
          "¿Querés cambiar un producto por otro? Mirá [Cambios y devoluciones](/cambios-y-devoluciones).",
          D.whatsapp && `¿Dudas? [Escribinos por WhatsApp](${D.whatsapp.href}).`,
        ],
      },
    ],
  };
}
