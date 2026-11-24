import { TicketPercent } from "lucide-react";
import { NewCouponButton } from "./new-coupon-button";

/** Lo que se ve cuando todavía no hay ningún cupón. */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-background px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft">
        <TicketPercent className="size-5 text-brand" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Todavía no hay cupones</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Un cupón es un código que tus clientes escriben al pagar para tener un descuento, por ejemplo BIENVENIDA
          (10 % en la primera compra) o ENVIOGRATIS.
        </p>
      </div>
      <NewCouponButton size="lg" label="Crear tu primer cupón" />
    </div>
  );
}
