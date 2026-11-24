import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  LogOut,
  PackageCheck,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
} from "lucide-react";
import { CustomerLogin } from "@/components/store/account/customer-login";
import { CopyCode } from "@/components/store/checkout/order-client";
import type { Tracking } from "@/lib/carriers";
import { DeleteAccount } from "@/components/store/account/delete-account";
import { DetailsForm } from "@/components/store/account/details-form";
import { getMyAccount, getMyOrders, safeReturnPath, type MyAccount, type MyOrder } from "@/lib/account";
import { firstNameOf, formatARS } from "@/lib/format";
import { ALL_PRODUCTS_LINK } from "@/lib/store-nav";
import { cn } from "@/lib/utils";
import { signOutCustomer } from "./actions";

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false, follow: false },
};

/**
 * /mi-cuenta — cuenta del CLIENTE (paso 6). A donde lleva "Ingresá" /
 * "Mi cuenta" del encabezado.
 *   - Sin sesión: ingreso con Google o con un código por email.
 *   - Con sesión: Mis pedidos, Mis datos, cerrar sesión y eliminar la cuenta.
 *
 * /admin/login es SOLO el ingreso del panel: no enlazarlo desde la tienda.
 * La cuenta de cliente no da ningún permiso en el panel.
 */
export default function MyAccountPage(props: PageProps<"/mi-cuenta">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 md:py-14">
      <Suspense fallback={<AccountSkeleton />}>
        <AccountContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function AccountContent({ searchParams }: Pick<PageProps<"/mi-cuenta">, "searchParams">) {
  const [params, account] = await Promise.all([searchParams, getMyAccount()]);
  if (!account) {
    return <LoginView returnTo={safeReturnPath(params.volver)} deleted={params.eliminada === "1"} />;
  }
  const orders = await getMyOrders(account.id);
  return <AccountView account={account} orders={orders} />;
}

// ---------------------------------------------------------------------------
// Sin sesión
// ---------------------------------------------------------------------------

function LoginView({ returnTo, deleted }: { returnTo: string | null; deleted: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-7">
      {deleted && (
        <p role="status" className="flex gap-2.5 rounded-xl bg-emerald-50 p-3.5 text-sm text-emerald-900">
          <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
          Eliminamos tu cuenta y tus datos personales. ¡Gracias por haber sido parte de Home Deko!
        </p>
      )}

      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-soft text-brand">
          <UserRound aria-hidden className="size-7" />
        </span>
        <h1 className="font-display text-3xl leading-tight font-semibold md:text-4xl">Ingresá a tu cuenta</h1>
        <p className="text-[15px] leading-7 text-muted-foreground">
          Seguí tus pedidos y comprá más rápido con tus datos guardados. Si es la primera vez, la cuenta se crea sola.
        </p>
      </div>

      <div className="rounded-2xl border p-5 sm:p-6">
        <CustomerLogin returnTo={returnTo} />
      </div>

      <ul className="flex flex-col gap-3 text-[15px] leading-6">
        <li className="flex items-start gap-3">
          <PackageCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
          <span>
            <span className="font-semibold">Tus pedidos en un solo lugar:</span> preparando, enviado o listo para retirar.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <Truck aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
          <span>
            <span className="font-semibold">Tu dirección guardada</span>, para no escribirla en cada compra.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <ShoppingBag aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
          <span>
            <span className="font-semibold">No hace falta tener cuenta para comprar:</span> también podés comprar como
            invitado.
          </span>
        </li>
      </ul>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Al ingresar aceptás los{" "}
        <Link href="/terminos" className="underline underline-offset-4 hover:text-foreground">
          Términos y condiciones
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" className="underline underline-offset-4 hover:text-foreground">
          Política de privacidad
        </Link>
        .
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Con sesión
// ---------------------------------------------------------------------------

function AccountView({ account, orders }: { account: MyAccount; orders: MyOrder[] }) {
  const first = account.details.name ? firstNameOf(account.details.name) : "";
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl leading-tight font-semibold md:text-4xl">
          {first ? `¡Hola, ${first}!` : "Mi cuenta"}
        </h1>
        <p className="text-[15px] break-all text-muted-foreground">{account.email}</p>
      </header>

      <Section id="pedidos" title="Mis pedidos">
        {orders.length === 0 ? <NoOrders /> : <OrderList orders={orders} />}
      </Section>

      <Section id="datos" title="Mis datos" description="Los usamos para completar tus compras.">
        <DetailsForm email={account.email} initial={account.details} />
      </Section>

      <Section id="sesion" title="Tu cuenta">
        <div className="flex flex-col gap-6">
          <form action={signOutCustomer}>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border px-5 text-[15px] font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
            >
              <LogOut aria-hidden className="size-4" />
              Cerrar sesión
            </button>
          </form>

          <div className="flex flex-col gap-3 border-t pt-5">
            <div>
              <h3 className="font-semibold">Eliminar mi cuenta</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Borramos tus datos personales y tu acceso. Los pedidos que ya hiciste se conservan sin vincularlos a
                ninguna cuenta, porque la ley nos obliga a guardar el registro de las ventas.{" "}
                <Link href="/privacidad" className="underline underline-offset-4 hover:text-foreground">
                  Más información
                </Link>
              </p>
            </div>
            {account.isAdmin ? (
              <p className="text-sm text-muted-foreground">
                Esta cuenta también entra al panel de Home Deko, así que no se puede eliminar desde la tienda.
              </p>
            ) : (
              <DeleteAccount />
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4 rounded-2xl border p-5 sm:p-6">
      <div>
        <h2 id={`${id}-title`} className="font-display text-xl font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * Cada pedido es una tarjeta: número, fecha, total y estado, el link al
 * detalle y, según el estado, el seguimiento del envío o los datos para
 * retirar. (No es un link entero porque adentro hay botones.)
 */
function OrderList({ orders }: { orders: MyOrder[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {orders.map((o) => (
        <li key={o.id} className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex items-start gap-3">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold">Pedido #{o.number}</span>
              <span className="text-sm text-muted-foreground">
                {dateFormat.format(new Date(o.createdAt))} · <span className="tabular-nums">{formatARS(o.total)}</span>
              </span>
            </span>
            <StatusBadge status={o.status} />
          </div>

          {o.tracking && <OrderTracking tracking={o.tracking} />}
          {o.pickup && <OrderPickup pickup={o.pickup} />}

          {o.href && (
            <Link
              href={o.href}
              className="inline-flex items-center gap-1 self-start text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              Ver detalle
              <span className="sr-only"> del pedido #{o.number}</span>
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/** En camino: empresa, código con "Copiar" y "Seguir mi envío" (misma lógica que la página del pedido). */
function OrderTracking({ tracking }: { tracking: Tracking }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/60 p-3.5">
      <p className="flex items-center gap-2 text-sm">
        <Truck aria-hidden className="size-4 shrink-0 text-brand" />
        <span>
          Lo enviamos por <strong className="font-semibold">{tracking.carrierLabel}</strong>.
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">Código de seguimiento</span>
          <span className="font-mono text-base font-semibold tracking-wide break-all">{tracking.code}</span>
        </span>
        <span className="ml-auto">
          <CopyCode code={tracking.code} />
        </span>
      </div>
      {tracking.url && (
        <div className="flex flex-col gap-1.5">
          <a
            href={tracking.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none sm:self-start"
          >
            Seguir mi envío <ExternalLink aria-hidden className="size-4" />
            <span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
          {!tracking.urlHasCode && (
            <p className="text-xs text-muted-foreground">En la página de seguimiento, pegá el código.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Listo para retirar: dirección y horarios del local. */
function OrderPickup({ pickup }: { pickup: NonNullable<MyOrder["pickup"]> }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-muted/60 p-3.5 text-sm leading-relaxed">
      <Store aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
      <p>
        <span className="font-semibold">Retiralo en el local:</span> {pickup.address}
        {pickup.hours && <span className="block text-muted-foreground">{pickup.hours}</span>}
        <span className="block text-muted-foreground">Al retirarlo, decinos tu nombre o el número de pedido.</span>
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: MyOrder["status"] }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
        status.tone === "ok" && "bg-emerald-50 text-emerald-800",
        status.tone === "done" && "bg-muted text-foreground",
        status.tone === "wait" && "bg-amber-50 text-amber-900",
        status.tone === "bad" && "bg-brand-soft text-brand-hover",
      )}
    >
      {status.label}
    </span>
  );
}

function NoOrders() {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-[15px] text-muted-foreground">Todavía no hiciste compras con esta cuenta.</p>
      <Link
        href={ALL_PRODUCTS_LINK.href}
        className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
      >
        Ver productos
      </Link>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-label="Cargando">
      <div className="h-10 w-56 animate-pulse rounded bg-muted" />
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border p-6">
          <div className="h-6 w-40 animate-pulse rounded bg-muted" />
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
        </div>
      ))}
    </div>
  );
}
