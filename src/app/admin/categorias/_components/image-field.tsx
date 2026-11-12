"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/images/compress";

export type ImageValue = {
  /** Archivo nuevo, ya comprimido (null = no se eligió uno nuevo). */
  file: File | null;
  /** true = el usuario quitó la imagen que ya tenía. */
  removed: boolean;
};

/**
 * Campo de imagen opcional: elegir (o arrastrar) un archivo, ver la vista
 * previa, cambiarla o quitarla. Comprime la imagen apenas se elige.
 */
export function ImageField({
  currentUrl,
  value,
  onChange,
  error,
  disabled,
}: {
  /** Imagen que ya tiene guardada la categoría (al editar). */
  currentUrl: string | null;
  value: ImageValue;
  onChange: (value: ImageValue) => void;
  error?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Vista previa del archivo nuevo: una URL temporal "blob:" que apunta al
  // archivo en memoria. Hay que liberarla cuando ya no se usa.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  function setPreview(file: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = file ? URL.createObjectURL(file) : null;
    setPreviewUrl(previewRef.current);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setProcessError(null);
    if (!file.type.startsWith("image/")) {
      setProcessError("Ese archivo no es una imagen.");
      return;
    }
    setProcessing(true);
    try {
      const compressed = await compressImage(file);
      setPreview(compressed);
      onChange({ file: compressed, removed: value.removed });
    } catch (e) {
      setProcessError(e instanceof Error ? e.message : "No se pudo procesar la imagen.");
    } finally {
      setProcessing(false);
    }
  }

  function handleRemove() {
    setPreview(null);
    setProcessError(null);
    // Si había una guardada, marcarla para borrar; si no, solo limpiar.
    onChange({ file: null, removed: currentUrl !== null });
  }

  const shownUrl = previewUrl ?? (value.removed ? null : currentUrl);
  const message = processError ?? error;

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = ""; // permite volver a elegir el mismo archivo
        }}
      />

      {shownUrl ? (
        <div className="flex items-center gap-3">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
            <Image
              src={shownUrl}
              alt="Vista previa de la imagen"
              fill
              sizes="80px"
              className="object-cover"
              // Las vistas previas "blob:" no pasan por el optimizador.
              unoptimized={shownUrl.startsWith("blob:")}
            />
            {processing && <ProcessingOverlay />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || processing}
              onClick={() => inputRef.current?.click()}
            >
              <Upload /> Cambiar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || processing}
              onClick={handleRemove}
              className="text-muted-foreground"
            >
              <Trash2 /> Quitar
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || processing}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
            dragOver && "border-foreground/40 bg-muted/60",
            message && "border-destructive/50",
          )}
        >
          {processing ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
          )}
          <span className="text-sm font-medium">
            {processing ? "Optimizando imagen…" : "Elegí una imagen o arrastrala acá"}
          </span>
          <span className="text-xs text-muted-foreground">
            JPG, PNG o WebP. Se optimiza automáticamente.
          </span>
        </button>
      )}

      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  );
}

function ProcessingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
    </div>
  );
}
