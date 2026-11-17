import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * Ícono de "Agregar a inicio" en iPhone / iPad.
 * iOS pinta de negro el fondo transparente de corazon.png, así que acá lo
 * ponemos sobre fondo blanco.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const heart = await readFile(path.join(process.cwd(), "public/brand/corazon.png"));
  const src = `data:image/png;base64,${heart.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={132} height={132} alt="" />
      </div>
    ),
    size,
  );
}
