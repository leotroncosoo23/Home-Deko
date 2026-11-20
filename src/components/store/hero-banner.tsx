import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { cn } from "cn";
import { Logo } from "@/components/brand/logo";
import { isExternalUrl, type BannerView } from "@/lib/banners";
import { ALL_PRODUCTS_LINK } from "@/lib/store-nav";

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
 *   - null      → banner de Home Deko por defecto (rojo, logo blanco).
 *   - template  → plantilla de marca: título, texto, botón y foto.
 *   - image     → imagen completa diseñada aparte (una para PC y otra
 *                 opcional para celular).
 *
 * Accesibilidad: el título va en <h2>. El <h1> de la página es "Home Deko"
 * (lo pide Google para verificar la marca; ver src/app/(tienda)/page.tsx).
 */
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
      {!banner ? (
        <DefaultBanner />
      ) : banner.kind === "image" ? (
        <ImageBanner banner={banner} layout={layout} priority={priority} />
      ) : (
        <TemplateBanner banner={banner} priority={priority} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Por defecto
// ---------------------------------------------------------------------------

function DefaultBanner() {
  return (
    <div className="flex flex-col items-center gap-6 overflow-hidden bg-brand px-6 py-14 text-center text-white @2xl:py-24">
      <Logo variant="stacked" tone="light" decorative preload className="h-auto w-36 @2xl:w-44" />
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

function TemplateBanner({ banner, priority }: { banner: BannerView; priority: boolean }) {
  const red = banner.background === "red";
  const hasPhoto = Boolean(banner.productImageUrl);

  return (
    <div
      className={cn(
        "grid overflow-hidden @2xl:min-h-[30rem]",
        hasPhoto && "@2xl:grid-cols-2",
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
const DESKTOP = { width: 1920, height: 800 };
const MOBILE = { width: 800, height: 1000 };

function ImageBanner({
  banner,
  layout,
  priority,
}: {
  banner: BannerView;
  layout: "responsive" | "mobile" | "desktop";
  priority: boolean;
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
            "block h-auto w-full",
            banner.imageMobileUrl ? "aspect-[4/5] object-cover md:aspect-[12/5]" : "aspect-[12/5] object-cover",
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

  const frame = "block overflow-hidden";
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
