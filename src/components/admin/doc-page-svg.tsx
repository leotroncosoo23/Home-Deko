import { PAGE_H, PAGE_W, type DocPage } from "@/lib/print/doc";

const gray = (level = 0) => {
  const v = Math.round(level * 255);
  return `rgb(${v} ${v} ${v})`;
};
const PT = 25.4 / 72;

/**
 * Una hoja A4 (rótulos o lista de preparación) dibujada en SVG con las
 * MISMAS posiciones que el PDF. El viewBox está en mm.
 */
export function DocPageSvg({ page, title }: { page: DocPage; title: string }) {
  return (
    <svg
      viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
      role="img"
      aria-label={title}
      className="block h-auto w-full bg-white"
      style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}
    >
      {page.lines.map((l, i) => (
        <line
          key={`l${i}`}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={gray(l.gray)}
          strokeWidth={l.width}
          strokeDasharray={l.dash?.join(" ")}
        />
      ))}
      {page.rects.map((r, i) => (
        <rect key={`r${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={gray(r.gray)} strokeWidth={r.width} />
      ))}
      {page.images.map((img, i) => (
        <image key={`i${i}`} href={img.src} x={img.x} y={img.y} width={img.w} height={img.h} preserveAspectRatio="none" />
      ))}
      {page.texts.map((t, i) => (
        <text
          key={`t${i}`}
          x={t.x}
          y={t.y}
          fontSize={t.sizePt * PT}
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight={t.bold ? 700 : 400}
          fill={gray(t.gray)}
          style={{ whiteSpace: "pre" }}
        >
          {t.text}
        </text>
      ))}
    </svg>
  );
}
