"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { SectionCard } from "@/components/admin/section-card";
import { AnnouncementTicker } from "@/components/store/announcement-ticker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUnsavedWarning } from "../../productos/_components/use-unsaved-warning";
import { saveAnnouncements } from "../actions";
import { ANNOUNCEMENT_MAX_LENGTH, ANNOUNCEMENTS_MAX, cleanAnnouncement, validateAnnouncements } from "../schema";

/**
 * Editor de la barra de anuncios: hasta 4 mensajes, con su orden y una
 * vista previa en vivo (el mismo componente que la tienda).
 * Se guardan todos juntos con "Guardar mensajes".
 */
export function AnnouncementsEditor({ initial }: { initial: string[] }) {
  // Siempre al menos un campo (vacío = sin barra).
  const [texts, setTexts] = useState<string[]>(initial.length > 0 ? initial : [""]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [pending, startTransition] = useTransition();

  const cleaned = texts.map(cleanAnnouncement).filter(Boolean);
  const dirty = JSON.stringify(cleaned) !== JSON.stringify(initial);
  const { allowLeave } = useUnsavedWarning(dirty && !pending);

  function update(next: string[]) {
    setTexts(next);
    setErrors({});
  }
  function change(i: number, value: string) {
    update(texts.map((t, j) => (j === i ? value : t)));
  }
  function move(i: number, delta: -1 | 1) {
    const next = [...texts];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    update(next);
  }
  function remove(i: number) {
    const next = texts.filter((_, j) => j !== i);
    update(next.length > 0 ? next : [""]);
  }

  function handleSave() {
    const check = validateAnnouncements(texts);
    if (!check.ok) {
      setErrors(check.itemErrors);
      toast.error(check.error);
      return;
    }
    startTransition(async () => {
      try {
        const result = await saveAnnouncements(texts);
        if (result.ok) {
          allowLeave();
          // Queda la lista limpia (sin vacíos), igual que en la tienda.
          setTexts(check.data.length > 0 ? check.data : [""]);
          toast.success(check.data.length > 0 ? "Barra de anuncios guardada" : "Barra de anuncios quitada");
        } else {
          setErrors(result.itemErrors ?? {});
          toast.error(result.error);
        }
      } catch {
        toast.error("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  return (
    <SectionCard
      icon={Megaphone}
      title="Barra de anuncios"
      description="La franja roja fina de arriba de todo. Con 2 o más mensajes, corren uno detrás del otro."
      contentClassName="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Vista previa</span>
        <div className="overflow-hidden rounded-lg border">
          {cleaned.length > 0 ? (
            <AnnouncementTicker messages={cleaned} />
          ) : (
            <p className="bg-muted/60 px-4 py-2.5 text-center text-sm text-muted-foreground">
              Sin mensajes: la barra no se muestra.
            </p>
          )}
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {texts.map((text, i) => (
          <li key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-sm font-medium text-muted-foreground tabular-nums">{i + 1}</span>
              <Input
                id={`anuncio-${i}`}
                value={text}
                onChange={(e) => change(i, e.target.value)}
                maxLength={ANNOUNCEMENT_MAX_LENGTH}
                placeholder={i === 0 ? "Ej.: Envíos a todo el país · Retiro gratis en Trevelin" : "Otro mensaje"}
                aria-label={`Mensaje ${i + 1}`}
                aria-invalid={errors[i] ? true : undefined}
                disabled={pending}
                autoComplete="off"
                className="flex-1"
              />
              <div className="flex shrink-0 items-center">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={pending || i === 0} aria-label={`Subir el mensaje ${i + 1}`}>
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={pending || i === texts.length - 1} aria-label={`Bajar el mensaje ${i + 1}`}>
                  <ArrowDown />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(i)} disabled={pending} aria-label={`Quitar el mensaje ${i + 1}`} className="text-muted-foreground hover:text-destructive">
                  <Trash2 />
                </Button>
              </div>
            </div>
            <p className={cn("pl-7 text-xs", errors[i] ? "text-destructive" : "text-muted-foreground")}>
              {errors[i] ?? `${text.length}/${ANNOUNCEMENT_MAX_LENGTH}`}
            </p>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => update([...texts, ""])} disabled={pending || texts.length >= ANNOUNCEMENTS_MAX}>
          <Plus /> Agregar mensaje
        </Button>
        <Button type="button" onClick={handleSave} disabled={pending || !dirty}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Guardando…" : "Guardar mensajes"}
        </Button>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Hasta {ANNOUNCEMENTS_MAX} mensajes cortos, de una línea. Si dejás todos vacíos, la barra no se muestra.
      </p>
    </SectionCard>
  );
}
