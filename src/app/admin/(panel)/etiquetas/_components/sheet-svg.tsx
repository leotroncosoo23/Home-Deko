import { ean13Bars } from "@/lib/labels/ean13";
import { PAGE_H, PAGE_W, type SheetBarcode, type SheetPage } from "@/lib/labels/layout";
import { CUT_DASH, CUT_GRAY, CUT_WIDTH, MUTED_GRAY } from "@/lib/labels/pdf";

const PT = 25.4 / 72; // 1 punto en mm (el SVG trabaja en mm, como el layout)
const gray = (level: number) => {
  const v = Math.round(level * 255);
  return `rgb(${v} ${v} ${v})`;
};

/**
 * Una hoja A4 dibujada en SVG con las MISMAS posiciones que el PDF
 * (las dos salen de buildSheets()). El viewBox está en mm, así que cada
 * número se usa tal cual.
 *
 * La tipografía es Helvetica (o Arial, que tiene las mismas medidas) y los
 * textos ya vienen recortados con las medidas reales del PDF.
 */
export function SheetSvg({ page, title }: { page: SheetPage; title: string }) {
  return (
    <svg
      viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
      role="img"
      aria-label={title}
      className="block h-auto w-full bg-white"
      style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}
    >
      {page.cuts.map((c, i) => (
        <line
          key={i}
          x1={c.x1}
          y1={c.y1}
          x2={c.x2}
          y2={c.y2}
          stroke={gray(CUT_GRAY)}
          strokeWidth={CUT_WIDTH}
          strokeDasharray={CUT_DASH.join(" ")}
        />
      ))}
      {page.barcodes.map((bc, i) => (
        <path key={i} d={barcodePath(bc)} fill="#000" />
      ))}
      <g fontFamily="Helvetica, Arial, sans-serif">
        {page.texts.map((t, i) => (
          <text
            key={i}
            x={t.x}
            y={t.y}
            fontSize={t.sizePt * PT}
            fontWeight={t.bold ? 700 : 400}
            fill={t.muted ? gray(MUTED_GRAY) : "#000"}
            style={{ whiteSpace: "pre" }}
          >
            {t.text}
          </text>
        ))}
      </g>
    </svg>
  );
}

/** Todas las barras de un código en un solo <path> (más liviano que muchos <rect>). */
function barcodePath(bc: SheetBarcode): string {
  return ean13Bars(bc.code)
    .map((bar) => {
      const x = bc.x + bar.x * bc.moduleX;
      const w = bar.width * bc.moduleX;
      const h = bc.barH + (bar.guard ? bc.guardExtra : 0);
      return `M${x.toFixed(4)} ${bc.top.toFixed(4)}h${w.toFixed(4)}v${h.toFixed(4)}h${(-w).toFixed(4)}z`;
    })
    .join("");
}
