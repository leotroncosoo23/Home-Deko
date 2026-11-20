/**
 * Animaciones de "agregar al carrito", con la Web Animations API del
 * navegador (sin librerías): una miniatura de la foto vuela hasta el ícono
 * del carrito y el ícono hace un rebote leve.
 *
 * El ícono del carrito se marca con data-cart-target. Hay dos en la página
 * (encabezado del celular y del escritorio): se usa el que se ve.
 */

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** El ícono del carrito que se ve ahora (el otro está oculto por el tamaño de pantalla). */
export function findCartTarget(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>("[data-cart-target]")) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

const FLY_MS = 700;

/**
 * Copia la foto (`source`) y la hace volar, achicándose, hasta `target`.
 * Se resuelve al llegar. Si no hay foto visible, se resuelve enseguida.
 */
export function flyToCart(source: HTMLElement | null, target: HTMLElement): Promise<void> {
  const img = source instanceof HTMLImageElement ? source : source?.querySelector("img");
  const from = source?.getBoundingClientRect();
  const src = img?.currentSrc || img?.src;
  if (!from || from.width === 0 || !src) return Promise.resolve();

  // La miniatura sale del centro de la foto con hasta 160 px (volar una foto
  // de 600 px tapa media pantalla y se ve torpe).
  const size = Math.min(160, from.width, from.height);
  const startX = from.left + from.width / 2 - size / 2;
  const startY = from.top + from.height / 2 - size / 2;
  const to = target.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (startX + size / 2);
  const dy = to.top + to.height / 2 - (startY + size / 2);
  const endScale = 22 / size;

  const ghost = document.createElement("img");
  ghost.src = src;
  ghost.alt = "";
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "cover",
    borderRadius: "16px",
    boxShadow: "0 12px 28px -10px rgb(43 43 43 / 0.45)",
    zIndex: "60",
    pointerEvents: "none",
    willChange: "transform, opacity",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(ghost);

  // Tres puntos: sale, sube un poco en curva y entra al carrito chiquita.
  const animation = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1, borderRadius: "16px" },
      {
        transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 70}px) scale(${Math.max(endScale, 0.55)})`,
        opacity: 1,
        offset: 0.45,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(${endScale})`, opacity: 0.5, borderRadius: "50%" },
    ],
    { duration: FLY_MS, easing: "cubic-bezier(0.5, 0, 0.3, 1)", fill: "forwards" },
  );

  return animation.finished
    .catch(() => undefined)
    .then(() => {
      ghost.remove();
    });
}

/** Rebote leve del ícono del carrito. */
export function bounce(el: HTMLElement): void {
  el.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.18)", offset: 0.35 },
      { transform: "scale(0.94)", offset: 0.7 },
      { transform: "scale(1)" },
    ],
    { duration: 450, easing: "ease-out" },
  );
}
