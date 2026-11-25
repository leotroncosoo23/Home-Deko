import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { cn } from "cn";
import { Logo } from "@/components/brand/logo";
import { BANNER_IMAGE_SIZES, isExternalUrl, type BannerView } from "@/lib/banners";
import { ALL_PRODUCTS_LINK } from "@/lib/store-nav";
import { HeroCarousel } from "./hero-carousel";

/**
 * BANNER PRINCIPAL del inicio.
 *
 * Es un componente "de presentación" (sin datos ni sesión): lo usan la
 * tienda y la VISTA PREVIA del panel, así lo que ven los dueños al editar
 * es exactamente lo que sale en la tienda.
 *
 * Se adapta al ANCHO DE SU CAJA (container queries: clases "@2xl:"), no al
 * de la pantalla. Así la vista previa del panel puede mostrarlo "como en
 * el celular" dentro de una PC, solo con hacer la caja angosta.
 *
 * Tipos:
 *   - null      → banner de Home Deko por defecto (rojo, solo texto: el logo ya está en el encabezado).
 *   - template  → plantilla de marca: título, texto, botón y foto.
 *   - image     → imagen completa diseñada aparte (una para PC y otra
 *                 opcional para celular).
 *
 * Accesibilidad: el título va en <h2>. El <h1> de la página es "Home Deko"
 * (lo pide Google para verificar la marca; ver src/app/(tienda)/page.tsx).
 */

/**
 * Los banners de la tienda (los vigentes, en el orden del panel):
 *   - ninguno → el de Home Deko por defecto.
 *   - uno     → fijo, igual que siempre (sin flechas ni puntitos).
 *   - 2 o 3   → carrusel (HeroCarousel): pasan solos cada 6 segundos.
 *
 * En el carrusel todas las diapositivas tienen el MISMO alto, fijado por
 * CSS antes de que cargue nada (no hay saltos de layout):
 *   PC:      1920 × 800 (12:5).
 *   Celular: 1080 × 1350 (4:5). Si NINGUNA diapositiva tiene formato de
 *            celular (todas son imágenes completas sin la versión para
 *            celular), 12:5 también en el celular, para no recortarlas.
 * Es un alto MÍNIMO: si el texto de una plantilla no entra, el carrusel
 * crece y todas las diapositivas lo acompañan (se estiran por igual).
 *
 * Solo la primera imagen carga con prioridad; el resto, cuando hace falta.
 */
export function HeroBanners({ banners }: { banners: BannerView[] }) {
  if (banners.length <= 1) return <HeroBanner banner={banners[0] ?? null} priority />;

  const tallOnMobile = banners.some((b) => b.kind === "template" || b.imageMobileUrl);

  return (
    <HeroCarousel
      slideClassName={tallOnMobile ? "aspect-[4/5] md:aspect-[12/5]" : "aspect-[12/5]"}
      slides={banners.map((banner, i) => ({
        // El orden no cambia mientras se ve la página: la posición sirve de clave.
        key: String(i),
        content: <BannerContent banner={banner} layout="responsive" priority={i === 0} fill />,
      }))}
    />
  );
}

export function HeroBanner({
  banner,
  layout = "responsive",
  priority = false,
  className,
}: {
  banner: BannerView | null;
  /**
   * Solo para imágenes completas: "responsive" elige la de celular o la de
   * PC según la pantalla (tienda). La vista previa del panel fuerza una.
   */
  layout?: "responsive" | "mobile" | "desktop";
  /** true en la tienda: es lo primero que se ve, que cargue primero. */
  priority?: boolean;
  className?: string;
}) {
  return (
    <section aria-label="Destacado" className={cn("@container", className)}>
      {banner ? <BannerContent banner={banner} layout={layout} priority={priority} /> : <DefaultBanner />}
    </section>
  );
}

/**
 * El contenido de un banner. fill: ocupa todo el alto de su caja (las
 * diapositivas del carrusel, que tienen un alto fijo); sin fill, el alto
 * lo da el propio banner.
 */
function BannerContent({
  banner,
  layout,
  priority,
  fill = false,
}: {
  banner: BannerView;
  layout: "responsive" | "mobile" | "desktop";
  priority: boolean;
  fill?: boolean;
}) {
  return banner.kind === "image" ? (
    <ImageBanner banner={banner} layout={layout} priority={priority} fill={fill} />
  ) : (
    <TemplateBanner banner={banner} priority={priority} fill={fill} />
  );
}

// ---------------------------------------------------------------------------
// Por defecto
// ---------------------------------------------------------------------------

/** Sin logo: ya está en el encabezado, justo arriba. Solo texto y fondo de marca. */
function DefaultBanner() {
  return (
    <div className="flex flex-col items-center gap-6 overflow-hidden bg-brand px-6 py-16 text-center text-white @2xl:py-24">
      <h2 className="max-w-xl font-display text-3xl leading-tight font-semibold text-balance @2xl:text-5xl">
        Tu casa, tu refugio, con diseño y calidez.
      </h2>
      <BannerButton href={ALL_PRODUCTS_LINK.href} label="Ver productos" background="red" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plantilla de marca
// ---------------------------------------------------------------------------

function TemplateBanner({ banner, priority, fill }: { banner: BannerView; priority: boolean; fill: boolean }) {
  const red = banner.background === "red";
  const hasPhoto = Boolean(banner.productImageUrl);

  return (
    <div
      className={cn(
        "grid overflow-hidden @2xl:min-h-[30rem]",
        hasPhoto && "@2xl:grid-cols-2",
        // En el carrusel: todo el alto de la diapositiva. Con foto, en el
        // celular el espacio que sobra va al texto (que queda centrado).
        fill && "h-full",
        fill && hasPhoto && "grid-rows-[auto_1fr] @2xl:grid-rows-1",
        red ? "bg-brand text-white" : "border-y bg-background text-foreground",
      )}
    >
      {hasPhoto && (
        <div className="relative aspect-[4/3] @2xl:order-2 @2xl:aspect-auto">
          <Image
            src={banner.productImageUrl!}
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            preload={priority}
            unoptimized={banner.productImageUrl!.startsWith("blob:")}
            className="object-cover"
          />
        </div>
      )}

      <div
        className={cn(
          "flex flex-col justify-center gap-4 px-6 py-8 @2xl:gap-5",
          hasPhoto
            ? // Con foto: el texto se alinea con el borde del contenido del sitio
              // (STORE_CONTAINER: 1440 px con 40 px de margen) aunque el banner
              // vaya de borde a borde. 50cqw = la mitad del ancho del banner.
              "@2xl:py-16 @2xl:pr-12 @2xl:pl-[max(2.5rem,calc(50cqw-720px+2.5rem))]"
            : "items-center text-center @2xl:px-12 @2xl:py-20",
        )}
      >
        {red && (
          <Logo
            variant="wordmark"
            tone="light"
            decorative
            className="h-7 w-auto self-start [.text-center_&]:self-center"
          />
        )}
        <h2 className="font-display text-3xl leading-tight font-semibold text-balance @2xl:text-5xl">
          {banner.title}
        </h2>
        {banner.body && (
          <p className={cn("max-w-md text-base leading-7 @2xl:text-lg", red ? "text-white/90" : "text-muted-foreground")}>
            {banner.body}
          </p>
        )}
        {banner.buttonLabel && banner.buttonUrl && (
          <BannerButton href={banner.buttonUrl} label={banner.buttonLabel} background={banner.background} />
        )}
      </div>
    </div>
  );
}

/** Botón del banner: blanco sobre rojo, rojo sobre blanco. */
function BannerButton({
  href,
  label,
  background,
}: {
  href: string;
  label: string;
  background: BannerView["background"];
}) {
  const className = cn(
    "inline-flex h-12 items-center justify-center self-start rounded-full px-7 text-base font-semibold transition-colors focus-visible:ring-4 focus-visible:outline-none",
    background === "red"
      ? "bg-white text-brand hover:bg-brand-soft focus-visible:ring-white/40"
      : "bg-brand text-white hover:bg-brand-hover focus-visible:ring-brand/30",
    // En el banner por defecto (centrado) el botón va al centro
    "[.text-center_&]:self-center",
  );

  if (isExternalUrl(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Imagen completa
// ---------------------------------------------------------------------------

/** Tamaños recomendados (los mismos que dice la Ayuda del panel). */
const DESKTOP = BANNER_IMAGE_SIZES.desktop;
const MOBILE = BANNER_IMAGE_SIZES.mobile;

function ImageBanner({
  banner,
  layout,
  priority,
  fill,
}: {
  banner: BannerView;
  layout: "responsive" | "mobile" | "desktop";
  priority: boolean;
  fill: boolean;
}) {
  const desktopUrl = banner.imageUrl;
  if (!desktopUrl) return <DefaultBanner />;
  const mobileUrl = banner.imageMobileUrl ?? desktopUrl;

  let picture: React.ReactNode;
  if (layout === "responsive") {
    // "Art direction": el navegador baja SOLO la imagen que corresponde.
    const common = { alt: banner.title, sizes: "100vw" };
    const {
      props: { srcSet: desktopSrcSet },
    } = getImageProps({ ...common, ...DESKTOP, src: desktopUrl });
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- el alt se pone explícito abajo
      props: { srcSet: mobileSrcSet, alt, ...rest },
    } = getImageProps({ ...common, ...(banner.imageMobileUrl ? MOBILE : DESKTOP), src: mobileUrl });

    picture = (
      <picture>
        <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
        <img
          {...rest}
          alt={banner.title}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className={cn(
            fill
              ? // Carrusel: cubre la diapositiva (el alto lo fija el carrusel).
                "absolute inset-0 block size-full object-cover"
              : cn(
                  "block h-auto w-full object-cover",
                  banner.imageMobileUrl ? "aspect-[4/5] md:aspect-[12/5]" : "aspect-[12/5]",
                ),
          )}
        />
      </picture>
    );
  } else {
    // Vista previa del panel: una sola imagen, la del formato elegido.
    const mobile = layout === "mobile" && Boolean(banner.imageMobileUrl);
    const src = mobile ? mobileUrl : desktopUrl;
    picture = (
      <Image
        src={src}
        alt={banner.title}
        {...(mobile ? MOBILE : DESKTOP)}
        unoptimized={src.startsWith("blob:")}
        className={cn("block h-auto w-full object-cover", mobile ? "aspect-[4/5]" : "aspect-[12/5]")}
      />
    );
  }

  const frame = cn("block overflow-hidden", fill && "relative h-full");
  if (!banner.buttonUrl) return <div className={frame}>{picture}</div>;

  // Con link: toda la imagen se puede tocar.
  return isExternalUrl(banner.buttonUrl) ? (
    <a href={banner.buttonUrl} target="_blank" rel="noopener noreferrer" className={frame}>
      {picture}
    </a>
  ) : (
    <Link href={banner.buttonUrl} className={frame}>
      {picture}
    </Link>
  );
}
