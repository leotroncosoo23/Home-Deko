/**
 * Textos de las PÁGINAS LEGALES de la tienda:
 *   /privacidad → PRIVACIDAD
 *   /terminos   → TERMINOS
 *
 * Para cambiar un texto, editalo acá: no hace falta tocar ningún componente.
 *
 * Cómo se arma cada documento:
 *   - Cada sección tiene un `id` (es el ancla del índice: /terminos#envios),
 *     un `titulo` y una lista de `bloques`.
 *   - Un bloque es un párrafo (texto) o una lista con viñetas ({ lista: [...] }).
 *   - "[COMPLETAR]" se ve RESALTADO en amarillo en la página, para que nadie
 *     lo pase por alto. Antes de lanzar la tienda no debería quedar ninguno.
 *   - Si cambiás algo importante, actualizá también `actualizado` (AAAA-MM-DD).
 *
 * Importante: estos textos son una base razonable, no un asesoramiento legal.
 * Conviene que los revise un contador o abogado antes del lanzamiento.
 */

// ---------------------------------------------------------------------------
// Datos del comercio (se usan en los dos documentos y en el pie de página)
// ---------------------------------------------------------------------------

export const COMERCIO = {
  nombre: "Home Deko",
  razonSocial: "[COMPLETAR]",
  cuit: "[COMPLETAR]",
  direccion: "Av. San Martín 677, Trevelin, Chubut, Argentina",
  sitio: "www.homedekotrevelin.com",
  email: "[COMPLETAR]",
  /** Horarios del local para retirar pedidos. */
  horarios: "[COMPLETAR]",
  /** Plazo para cambios (que no sean por arrepentimiento ni por falla). Ej.: "30 días corridos". */
  plazoCambio: "[COMPLETAR]",
  /** Precio fijo del envío a domicilio (ver CLAUDE.md). */
  envioDomicilio: "$ 20.000",
};

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Bloque = string | { lista: string[] };

export type Seccion = {
  /** Ancla en la URL (sin espacios ni tildes). */
  id: string;
  titulo: string;
  bloques: Bloque[];
};

export type DocumentoLegal = {
  titulo: string;
  /** Una o dos frases que van debajo del título. */
  resumen: string;
  /** Fecha de "Última actualización", en formato AAAA-MM-DD. */
  actualizado: string;
  secciones: Seccion[];
};

const C = COMERCIO;

// ---------------------------------------------------------------------------
// Política de privacidad
// ---------------------------------------------------------------------------

export const PRIVACIDAD: DocumentoLegal = {
  titulo: "Política de privacidad",
  resumen: `Cómo cuidamos tus datos cuando comprás o creás una cuenta en ${C.sitio}. Lo explicamos en simple: qué datos pedimos, para qué y qué podés hacer con ellos.`,
  actualizado: "2026-11-17",
  secciones: [
    {
      id: "responsable",
      titulo: "Quiénes somos",
      bloques: [
        `${C.nombre} es una tienda de artículos para el hogar con local en ${C.direccion}. Somos los responsables de los datos personales que se cargan en ${C.sitio}.`,
        {
          lista: [
            `Razón social: ${C.razonSocial}`,
            `CUIT: ${C.cuit}`,
            `Domicilio: ${C.direccion}`,
            `Email de contacto: ${C.email}`,
          ],
        },
      ],
    },
    {
      id: "datos",
      titulo: "Qué datos recolectamos",
      bloques: [
        "Solo pedimos los datos que necesitamos para venderte y entregarte tu compra:",
        {
          lista: [
            "Datos de tu cuenta: nombre, email y, si entrás con Google, tu foto de perfil. Si creás la cuenta con email, también una contraseña (que se guarda cifrada: nadie puede leerla, ni siquiera nosotros).",
            "Datos de tus compras: productos, montos, fecha, estado del pedido y medio de pago usado.",
            "Datos de envío: nombre de quien recibe, dirección, localidad, provincia, código postal y teléfono.",
            "Datos de contacto: lo que nos escribas por email, WhatsApp o redes sociales.",
          ],
        },
        "Podés comprar como invitado, sin crear una cuenta. En ese caso pedimos nombre, email, teléfono y, si elegís envío, la dirección.",
      ],
    },
    {
      id: "google",
      titulo: "Inicio de sesión con Google",
      bloques: [
        `Podés crear tu cuenta en ${C.sitio} con el botón "Continuar con Google". Es opcional: también podés comprar como invitado o crear la cuenta con email y contraseña.`,
        "Qué datos de Google usamos. Al iniciar sesión, Google nos comparte únicamente:",
        {
          lista: [
            "Tu nombre.",
            "Tu dirección de email.",
            "Tu foto de perfil.",
          ],
        },
        "No pedimos ni recibimos tu contraseña de Google, ni acceso a tus correos de Gmail, contactos, calendario, archivos de Drive, ubicación ni a ningún otro dato o servicio de tu cuenta de Google.",
        "Para qué los usamos. Solo para:",
        {
          lista: [
            "Crear tu cuenta en la tienda e identificarte cada vez que entrás, sin que tengas que crear otra contraseña.",
            "Mostrarte tus pedidos y su seguimiento (preparando, enviado con código de seguimiento, listo para retirar, entregado).",
            "Completar tu nombre y email al comprar y mandarte los emails de tus compras (confirmación, envío y aviso de retiro).",
            "Mostrar tu nombre y tu foto en el menú de tu cuenta.",
          ],
        },
        "No usamos tus datos de Google para publicidad, no los usamos para armar perfiles y no te mandamos promociones sin tu permiso.",
        "No los compartimos ni los vendemos. Nunca vendemos, alquilamos ni cedemos tus datos de Google a nadie. Solo los guarda, en nuestro nombre, el proveedor de base de datos e inicio de sesión que hace funcionar la tienda, que no puede usarlos para nada más. Además, el uso de la información recibida de las API de Google cumple con la Política de datos del usuario de los servicios de API de Google (Google API Services User Data Policy), incluidos los requisitos de uso limitado.",
        "Cuánto tiempo los guardamos. Tu nombre, email y foto de perfil se guardan mientras tengas tu cuenta. Si pedís borrar la cuenta, los eliminamos dentro de los 5 días hábiles. Lo único que conservamos son los datos de las compras que ya hiciste (por ejemplo, el nombre y el email que figuran en un pedido), durante el plazo que exigen las leyes contables e impositivas (hasta 10 años, según el artículo 328 del Código Civil y Comercial), y solo para cumplir esas obligaciones.",
        `Cómo pedir que se borren. Escribinos a ${C.email} desde el email de tu cuenta de Google, con el asunto "Borrar mi cuenta", o pedilo personalmente en el local (${C.direccion}). Te confirmamos por email cuando esté hecho. Es gratis y no tenés que explicar el motivo.`,
        "Cómo quitarnos el acceso. Además, podés desconectar Home Deko de tu cuenta de Google cuando quieras en myaccount.google.com/connections. Así Google deja de compartirnos tus datos; para borrar los que ya guardamos, pedilo como se explica arriba.",
      ],
    },
    {
      id: "uso",
      titulo: "Para qué usamos tus datos",
      bloques: [
        {
          lista: [
            "Procesar tus compras y confirmar el pago.",
            "Preparar y enviar tu pedido, o avisarte cuando está listo para retirar.",
            "Mandarte emails sobre tu compra: confirmación, envío con código de seguimiento y aviso de retiro.",
            "Responder tus consultas, cambios y devoluciones.",
            "Cumplir con nuestras obligaciones legales, contables e impositivas.",
            "Mejorar la tienda con estadísticas anónimas de visitas (ver \"Cookies y medición de visitas\").",
          ],
        },
        "No te vamos a mandar publicidad por email sin tu permiso.",
      ],
    },
    {
      id: "pagos",
      titulo: "Pagos con Mercado Pago",
      bloques: [
        "Los pagos se hacen a través de Mercado Pago. Cuando pagás, cargás los datos de tu tarjeta o cuenta directamente en Mercado Pago, no en nuestro sitio.",
        "Nosotros no vemos ni guardamos los datos de tus tarjetas. Mercado Pago solo nos informa si el pago fue aprobado, el monto y el medio de pago usado. El uso de tus datos por parte de Mercado Pago se rige por su propia política de privacidad.",
      ],
    },
    {
      id: "compartir",
      titulo: "Con quién compartimos tus datos",
      bloques: [
        "Nunca vendemos ni alquilamos tus datos. Solo los compartimos, en la medida necesaria, con:",
        {
          lista: [
            "Mercado Pago, para procesar el pago.",
            "Correo Argentino, para enviarte el pedido (nombre, dirección y teléfono).",
            "Los proveedores tecnológicos que hacen funcionar la tienda: alojamiento del sitio, base de datos e inicio de sesión, y envío de emails. Solo pueden usar los datos para prestarnos ese servicio.",
            "Autoridades, cuando una ley o una orden judicial nos obligue.",
          ],
        },
        "Algunos de estos proveedores pueden guardar la información en servidores fuera de Argentina, con medidas de seguridad adecuadas.",
      ],
    },
    {
      id: "cookies",
      titulo: "Cookies y medición de visitas",
      bloques: [
        "Las cookies son pequeños archivos que el sitio guarda en tu navegador. Usamos:",
        {
          lista: [
            "Cookies necesarias: para mantener tu sesión iniciada y que la tienda funcione (por ejemplo, el carrito). Sin ellas el sitio no funciona bien.",
            "Medición anónima de visitas: contamos cuántas personas visitan la tienda, qué productos miran y de dónde llegan (por ejemplo, Instagram o Google). Es un contador propio que no guarda tu nombre, tu email ni ningún dato que te identifique.",
          ],
        },
        "No usamos cookies de publicidad ni de seguimiento de terceros. Podés borrar o bloquear las cookies desde la configuración de tu navegador, pero si bloqueás las necesarias quizás no puedas iniciar sesión o comprar.",
      ],
    },
    {
      id: "conservacion",
      titulo: "Cuánto tiempo guardamos tus datos",
      bloques: [
        "Los datos de tu cuenta se guardan mientras la tengas activa. Si nos pedís que la borremos, lo hacemos dentro de los 5 días hábiles (ver \"Inicio de sesión con Google\").",
        "Los datos de las compras los conservamos el tiempo que exigen las normas contables e impositivas, aunque borres tu cuenta.",
      ],
    },
    {
      id: "seguridad",
      titulo: "Seguridad",
      bloques: [
        "Usamos conexión segura (HTTPS), contraseñas cifradas y accesos restringidos: solo los administradores de Home Deko pueden ver los datos de los pedidos. Ningún sistema es 100 % infalible, pero tomamos medidas razonables para proteger tu información.",
      ],
    },
    {
      id: "derechos",
      titulo: "Tus derechos",
      bloques: [
        "Según la Ley 25.326 de Protección de los Datos Personales, podés en cualquier momento:",
        {
          lista: [
            "Acceder a tus datos: saber qué datos tuyos tenemos.",
            "Rectificarlos o actualizarlos si están mal o cambiaron.",
            "Pedir que los borremos (supresión), salvo los que la ley nos obligue a conservar.",
            "Pedir que no los usemos para algo en particular.",
          ],
        },
        `Para hacerlo, escribinos a ${C.email} desde el email de tu cuenta (o indicando el email que usaste en la compra). Te respondemos dentro de los plazos que fija la ley: 10 días corridos para el acceso y 5 días hábiles para rectificar o borrar.`,
        "El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326.",
        "La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.",
      ],
    },
    {
      id: "menores",
      titulo: "Menores de edad",
      bloques: [
        "La tienda está pensada para personas mayores de 18 años. Si sos menor, pedile a una persona adulta que haga la compra por vos.",
      ],
    },
    {
      id: "cambios",
      titulo: "Cambios en esta política",
      bloques: [
        "Si cambiamos esta política, publicamos la versión nueva en esta página con la fecha de \"Última actualización\". Si el cambio es importante, también lo avisamos en la tienda.",
      ],
    },
    {
      id: "contacto",
      titulo: "Contacto",
      bloques: [
        "Por cualquier consulta sobre tus datos:",
        {
          lista: [
            `Email: ${C.email}`,
            `En el local: ${C.direccion}`,
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Términos y condiciones
// ---------------------------------------------------------------------------

export const TERMINOS: DocumentoLegal = {
  titulo: "Términos y condiciones",
  resumen: `Las reglas para usar la tienda online de ${C.nombre} y comprar en ${C.sitio}: precios, pagos, envíos, cambios y devoluciones.`,
  actualizado: "2026-11-17",
  secciones: [
    {
      id: "comercio",
      titulo: "Datos del comercio",
      bloques: [
        {
          lista: [
            `Nombre: ${C.nombre}`,
            `Razón social: ${C.razonSocial}`,
            `CUIT: ${C.cuit}`,
            `Domicilio: ${C.direccion}`,
            `Sitio web: ${C.sitio}`,
            `Email: ${C.email}`,
          ],
        },
      ],
    },
    {
      id: "uso",
      titulo: "Uso del sitio",
      bloques: [
        "Al navegar o comprar en la tienda aceptás estos términos y nuestra Política de privacidad. Si no estás de acuerdo, por favor no uses el sitio.",
        "Te pedimos que uses la tienda de buena fe: con datos reales, sin intentar dañar el sitio ni acceder a partes que no son públicas.",
      ],
    },
    {
      id: "cuenta",
      titulo: "Cuenta y compra como invitado",
      bloques: [
        "Podés comprar como invitado o crear una cuenta (con Google o con email y contraseña) para ver tus pedidos y su estado.",
        "Sos responsable de que los datos que cargás sean correctos, sobre todo la dirección de envío y el teléfono, y de cuidar el acceso a tu cuenta.",
      ],
    },
    {
      id: "precios",
      titulo: "Precios y stock",
      bloques: [
        {
          lista: [
            "Los precios están en pesos argentinos (ARS) e incluyen IVA.",
            "El costo de envío no está incluido en el precio del producto: se muestra aparte antes de pagar.",
            "Los precios y promociones pueden cambiar sin aviso, pero se respeta siempre el precio que figuraba cuando confirmaste la compra.",
            "Solo se puede comprar lo que tiene stock. Como el stock es el mismo que el del local, si al momento de confirmar el pago un producto se agotó, te avisamos y te devolvemos el dinero de ese producto.",
            "Las fotos son ilustrativas: los colores pueden verse un poco distintos según la pantalla.",
            "Si hay un error evidente en un precio (por ejemplo, un cero de menos), podemos cancelar la compra y devolverte el total.",
          ],
        },
      ],
    },
    {
      id: "pagos",
      titulo: "Medios de pago",
      bloques: [
        "Los pagos se hacen con Mercado Pago, que acepta tarjetas de crédito y débito, dinero en cuenta y otros medios que ofrezca en ese momento. Las cuotas y sus costos los define Mercado Pago o tu banco.",
        "Tu pedido queda confirmado cuando Mercado Pago nos informa que el pago fue aprobado. Si el pago queda pendiente o es rechazado, el pedido no se prepara.",
        "Ante una devolución, el dinero se reintegra por el mismo medio de pago, en los plazos de Mercado Pago y de la entidad emisora.",
      ],
    },
    {
      id: "envios",
      titulo: "Envío a domicilio y retiro en el local",
      bloques: [
        "Al comprar elegís cómo recibir tu pedido:",
        {
          lista: [
            `Envío a domicilio: ${C.envioDomicilio}, precio fijo a cualquier lugar del país. Lo despachamos por Correo Argentino y te mandamos el código de seguimiento por email. El plazo de entrega depende del Correo y de la zona.`,
            `Retiro en el local: gratis, en ${C.direccion}. Te avisamos por email cuando está listo. Horarios: ${C.horarios}. Para retirar, presentá el número de pedido y el DNI de quien hizo la compra (o de la persona que autorices).`,
          ],
        },
        "Si el envío vuelve porque la dirección estaba mal o nadie lo recibió, coordinamos con vos un nuevo envío, que puede tener un nuevo costo.",
        "Al recibir el paquete, revisalo. Si llegó dañado o falta algo, avisanos dentro de las 48 horas con fotos.",
      ],
    },
    {
      id: "cambios",
      titulo: "Cambios y devoluciones",
      bloques: [
        {
          lista: [
            `Cambios: tenés ${C.plazoCambio} desde que recibís el producto para cambiarlo por otro. Tiene que estar sin uso, en perfecto estado y con su embalaje original.`,
            "Productos con falla: si un producto llega fallado o con un defecto, lo cambiamos o te devolvemos el dinero, sin costo para vos, según la garantía legal de la Ley 24.240 de Defensa del Consumidor.",
            "Los cambios se pueden hacer en el local o por envío. Si el cambio no es por falla nuestra, el costo del envío lo paga el cliente.",
          ],
        },
        `Para iniciar un cambio o devolución, escribinos a ${C.email} con tu número de pedido.`,
      ],
    },
    {
      id: "arrepentimiento",
      titulo: "Derecho de arrepentimiento",
      bloques: [
        "Si compraste por la tienda online, tenés derecho a arrepentirte de la compra dentro de los 10 días corridos desde que recibiste el producto, sin dar explicaciones y sin ningún costo (artículo 34 de la Ley 24.240 y artículo 1110 del Código Civil y Comercial).",
        {
          lista: [
            "Avisanos dentro de ese plazo por el \"Botón de arrepentimiento\" de la tienda o escribiendo a nuestro email.",
            "El producto tiene que volver en el mismo estado en que lo recibiste.",
            "Nos hacemos cargo de los gastos de devolución.",
            "Te devolvemos el total pagado, incluido el envío, por el mismo medio de pago.",
          ],
        },
        "Este derecho no se puede renunciar ni limitar.",
      ],
    },
    {
      id: "propiedad",
      titulo: "Propiedad intelectual",
      bloques: [
        `La marca ${C.nombre}, el logo, las fotos y los textos del sitio son de ${C.nombre} o se usan con permiso. No se pueden copiar ni usar con fines comerciales sin nuestra autorización.`,
      ],
    },
    {
      id: "responsabilidad",
      titulo: "Responsabilidad",
      bloques: [
        "Hacemos lo posible para que el sitio funcione siempre y la información sea correcta, pero puede haber interrupciones o errores. No respondemos por fallas de servicios de terceros (como Mercado Pago, Correo Argentino o tu proveedor de internet), sin perjuicio de los derechos que te da la Ley de Defensa del Consumidor.",
      ],
    },
    {
      id: "modificaciones",
      titulo: "Cambios en estos términos",
      bloques: [
        "Podemos actualizar estos términos. La versión nueva se publica en esta página con su fecha de \"Última actualización\" y se aplica a las compras hechas desde ese momento.",
      ],
    },
    {
      id: "ley",
      titulo: "Ley aplicable y contacto",
      bloques: [
        "Estos términos se rigen por las leyes de la República Argentina. Si tenés un reclamo, escribinos primero: lo vamos a resolver lo antes posible. También podés recurrir a Defensa del Consumidor.",
        {
          lista: [
            `Email: ${C.email}`,
            `En el local: ${C.direccion}`,
          ],
        },
      ],
    },
  ],
};
