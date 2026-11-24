import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type ProductStatus } from "../types";

/** Colores de estado del CLAUDE.md: verde publicado, gris borrador/archivado. */
export function StatusBadge({ status }: { status: ProductStatus }) {
  if (status === "active") {
    return <Badge className="bg-emerald-50 text-emerald-700">{STATUS_LABELS.active}</Badge>;
  }
  if (status === "archived") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {STATUS_LABELS.archived}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      {STATUS_LABELS.draft}
    </Badge>
  );
}
