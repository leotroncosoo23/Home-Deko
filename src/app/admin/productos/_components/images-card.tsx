"use client";

import { useEffect, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isColorOption } from "@/lib/colors";
import { compressImage } from "@/lib/images/compress";
import { discardProductImages, uploadProductImage } from "../actions";
import { newKey } from "../form-state";
import type { FormCardProps, FormImage } from "../types";
import { ImageTile } from "./image-tile";

const MAX_IMAGES = 20;
const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Fotos del producto: soltar varias a la vez (o elegirlas), cada una se
 * comprime y se SUBE APENAS SE ELIGE (así guardar es rápido). Se ordenan
 * arrastrando; la primera es la principal. Se pueden asociar a un color.
 */
export function ImagesCard({ values, update, disabled }: FormCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Fotos que ya estaban guardadas cuando se abrió el formulario: esas las
  // borra saveProduct al guardar. Las demás, si se quitan, se borran ya.
  const [savedPaths] = useState(() => new Set(values.images.map((img) => img.storagePath)));
  // Archivos originales (para "Reintentar") y fotos quitadas mientras subían.
  const files = useRef(new Map<string, File>());
  const removedWhileUploading = useRef(new Set<string>());
  // Vistas previas "blob:" para liberar al salir.
  const blobUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = blobUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const colorOption = values.hasVariants
    ? values.options.find((o) => isColorOption(o.name) && o.values.length > 0)
    : undefined;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // En el celular: mantener apretado un momento para arrastrar (así se
    // puede seguir haciendo scroll tocando las fotos).
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function patchImage(uid: string, patch: Partial<FormImage>) {
    update((v) => ({ images: v.images.map((img) => (img.uid === uid ? { ...img, ...patch } : img)) }));
  }

  /** Comprime y sube una foto; al terminar, la marca como lista (o con error). */
  async function uploadOne(uid: string, file: File, productId: string) {
    try {
      const compressed = await compressImage(file, { maxSize: 1600 });
      const formData = new FormData();
      formData.set("productId", productId);
      formData.set("file", compressed);
      const result = await uploadProductImage(formData);

      if (!result.ok) {
        patchImage(uid, { uploading: false, error: result.error });
        return;
      }
      // ¿La quitaron mientras subía? Entonces se borra enseguida.
      if (removedWhileUploading.current.has(uid)) {
        void discardProductImages(productId, [result.storagePath]);
        return;
      }
      files.current.delete(uid);
      patchImage(uid, { uploading: false, error: null, storagePath: result.storagePath, url: result.url });
    } catch (e) {
      const message = e instanceof Error && e.message.startsWith("No se pudo") ? e.message : "No se pudo subir.";
      patchImage(uid, { uploading: false, error: message });
    }
  }

  function addFiles(list: FileList | File[]) {
    const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      toast.error("Elegí archivos de imagen (JPG, PNG o WebP).");
      return;
    }
    const room = MAX_IMAGES - values.images.length;
    if (room <= 0) {
      toast.error(`Máximo ${MAX_IMAGES} fotos por producto.`);
      return;
    }
    const accepted = images.slice(0, room);
    if (images.length > room) toast.info(`Se agregaron ${room}: el máximo es ${MAX_IMAGES} fotos.`);

    // Un producto nuevo todavía no tiene id: se crea ahora, para la carpeta.
    const productId = values.id ?? crypto.randomUUID();

    const added = accepted.map((file) => {
      const uid = newKey("img");
      const previewUrl = URL.createObjectURL(file);
      blobUrls.current.add(previewUrl);
      files.current.set(uid, file);
      return { uid, file, previewUrl };
    });

    update((v) => ({
      id: v.id ?? productId,
      images: [
        ...v.images,
        ...added.map(({ uid, previewUrl }) => ({
          uid,
          storagePath: "",
          url: "",
          previewUrl,
          uploading: true,
          error: null,
          colorValueKey: null,
        })),
      ],
    }));

    // Se suben de a una por vez (más amable con conexiones lentas).
    void (async () => {
      for (const { uid, file } of added) await uploadOne(uid, file, productId);
    })();
  }

  function retry(image: FormImage) {
    const file = files.current.get(image.uid);
    if (!file || !values.id) return;
    patchImage(image.uid, { uploading: true, error: null });
    void uploadOne(image.uid, file, values.id);
  }

  function remove(image: FormImage) {
    if (image.uploading) removedWhileUploading.current.add(image.uid);
    // Subida en esta sesión y todavía sin guardar → borrar ya de Storage
    if (image.storagePath && !savedPaths.has(image.storagePath) && values.id) {
      void discardProductImages(values.id, [image.storagePath]);
    }
    files.current.delete(image.uid);
    update((v) => ({ images: v.images.filter((img) => img.uid !== image.uid) }));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    update((v) => {
      const from = v.images.findIndex((img) => img.uid === active.id);
      const to = v.images.findIndex((img) => img.uid === over.id);
      return { images: arrayMove(v.images, from, to) };
    });
  }

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setDragOver(false);
      if (!disabled) addFiles(e.dataTransfer.files);
    },
  };

  const { images } = values;
  const uploadingCount = images.filter((img) => img.uploading).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Fotos{" "}
          {images.length > 0 && (
            <span className="font-normal text-muted-foreground tabular-nums">
              ({images.length}/{MAX_IMAGES})
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {uploadingCount > 0
            ? `Subiendo ${uploadingCount === 1 ? "1 foto" : `${uploadingCount} fotos`}…`
            : "La primera es la principal. Arrastrá para cambiar el orden."}
        </CardDescription>
      </CardHeader>
      <CardContent {...dropHandlers} className={cn("rounded-lg transition-colors", dragOver && "bg-muted/60")}>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = ""; // permite volver a elegir los mismos archivos
          }}
        />

        {images.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className={cn(
              "flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
              dragOver && "border-foreground/40",
            )}
          >
            <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium">Arrastrá las fotos acá o tocá para elegirlas</span>
            <span className="text-xs text-muted-foreground">
              Podés elegir varias. JPG, PNG o WebP; se optimizan solas.
            </span>
          </button>
        ) : (
          <DndContext id="product-images-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={images.map((img) => img.uid)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {images.map((image, i) => (
                  <ImageTile
                    key={image.uid}
                    image={image}
                    index={i}
                    colorValues={colorOption?.values ?? []}
                    disabled={disabled}
                    onMakePrimary={() =>
                      // "Principal" = pasarla al primer lugar
                      update((v) => {
                        const current = v.images.find((img) => img.uid === image.uid);
                        return current
                          ? { images: [current, ...v.images.filter((img) => img.uid !== image.uid)] }
                          : {};
                      })
                    }
                    onRemove={() => remove(image)}
                    onRetry={() => retry(image)}
                    onColorChange={(colorValueKey) => patchImage(image.uid, { colorValueKey })}
                  />
                ))}
                {images.length < MAX_IMAGES && (
                  <li>
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={disabled}
                      className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <ImagePlus className="size-5" aria-hidden />
                      Agregar
                    </button>
                  </li>
                )}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {colorOption && images.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Si una foto es de un color, elegilo abajo de la foto: en la tienda se va a mostrar al elegir ese color.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
