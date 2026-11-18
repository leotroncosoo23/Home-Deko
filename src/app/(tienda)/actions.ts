"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { CUSTOMER_VIEW_COOKIE, CUSTOMER_VIEW_VALUE } from "@/lib/store-viewer";

/**
 * "Ver como cliente" (barra de admin de la tienda): guarda o borra la
 * cookie de preferencia y vuelve a pedir la página.
 *
 * No hace falta verificar el rol: la cookie solo puede OCULTAR cosas
 * (borradores y avisos para los dueños). Que un cliente vea un borrador lo
 * impide la base, con o sin esta cookie.
 */
export async function setCustomerView(on: boolean): Promise<void> {
  if (typeof on !== "boolean") return;
  const cookieStore = await cookies();

  if (on) {
    cookieStore.set(CUSTOMER_VIEW_COOKIE, CUSTOMER_VIEW_VALUE, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      // Sin maxAge: dura hasta cerrar el navegador (así no queda "pegada").
    });
  } else {
    cookieStore.delete(CUSTOMER_VIEW_COOKIE);
  }
  refresh();
}
