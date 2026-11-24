"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CouponDialog } from "./coupon-dialog";

/** Botón "Nuevo cupón" + su diálogo (en el encabezado y en el estado vacío). */
export function NewCouponButton({ size = "default", label = "Nuevo cupón" }: { size?: "default" | "lg"; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <CouponDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
