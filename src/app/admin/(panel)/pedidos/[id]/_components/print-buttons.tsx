"use client";

import { ClipboardList, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrintOrders } from "../../_components/print-dialogs";

/** "Imprimir rótulo" y "Lista de preparación" de un solo pedido. */
export function PrintButtons({ orderId, pickup }: { orderId: string; pickup: boolean }) {
  const print = usePrintOrders();
  return (
    <div className="flex flex-wrap gap-2">
      {!pickup && (
        <Button variant="outline" className="bg-background" onClick={() => print.labels([orderId])} disabled={print.loading}>
          {print.loading ? <Loader2 className="animate-spin" /> : <Printer />} Imprimir rótulo
        </Button>
      )}
      <Button variant="outline" className="bg-background" onClick={() => print.picking([orderId])} disabled={print.loading}>
        <ClipboardList /> Lista de preparación
      </Button>
      {print.dialogs}
    </div>
  );
}
