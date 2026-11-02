import type { Clash, ClashItem } from "./clash-types";

export type Importance = "relevant" | "review" | "outside";
export const IMPORTANCE_LABELS: Record<Importance, string> = {
  relevant: "Relevantes ahora",
  review: "Otros encuentros por revisar",
  outside: "Fuera del foco · colgadores",
};

const normalized = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const structural = new Set([
  "pilares estructurales",
  "structural columns",
  "armazon estructural",
  "structural framing",
  "cimentacion estructural",
  "structural foundations",
]);

export function isHanger(item: ClashItem) {
  return /colgador|hanger/.test(normalized(item.family ?? ""));
}

export function encounterGroup(item: ClashItem): string {
  // Prefer the built-in exported category, even if the project maps its category
  // field to a custom parameter. Never derive an axis label from the family.
  for (const name of [
    "Componente Categoría",
    "Elemento Categoría",
    "Element Category",
    "Componente Categoria",
    "Elemento Categoria",
  ]) {
    const category = item.raw?.[name]?.trim();
    if (category) return category;
  }
  return item.category?.trim() || "Categoría no exportada";
}

export function classifyImportance(
  clash: Clash,
  excludeHangers = true,
  includeHighSeverity = true,
): { importance: Importance; reason: string } {
  if (excludeHangers && clash.items.some(isHanger)) {
    return {
      importance: "outside",
      reason:
        "Familia de colgador: fuera del foco según el criterio seleccionado; requiere verificar el contacto.",
    };
  }
  if (clash.items.some((item) => encounterGroup(item) === "Categoría no exportada")) {
    return {
      importance: "review",
      reason: "Falta categoría de uno o ambos objetos; completar información antes de priorizar.",
    };
  }
  if (clash.items.some((item) => structural.has(normalized(encounterGroup(item))))) {
    return {
      importance: "relevant",
      reason:
        "Encuentro con columnas, vigas, perfiles o cimentaciones: priorizar revisión de la solución.",
    };
  }
  if (includeHighSeverity && clash.severity === "alta") {
    return {
      importance: "relevant",
      reason: "Severidad alta según los umbrales configurados para el proyecto.",
    };
  }
  return {
    importance: "review",
    reason: "Otros encuentros: revisar geometría y coordinación entre disciplinas.",
  };
}

export function buildImportanceMatrix(
  clashes: Clash[],
  excludeHangers = true,
  includeHighSeverity = true,
) {
  const counts: Record<Importance, number> = { relevant: 0, review: 0, outside: 0 };
  const cells = new Map<
    string,
    { a: string; b: string; count: number; counts: Record<Importance, number> }
  >();
  const rowTotals = new Map<string, number>();
  const columnTotals = new Map<string, number>();
  for (const clash of clashes) {
    const a = encounterGroup(clash.items[0]);
    const b = encounterGroup(clash.items[1]);
    const key = JSON.stringify([a, b]);
    const { importance } = classifyImportance(clash, excludeHangers, includeHighSeverity);
    const cell = cells.get(key) ?? {
      a,
      b,
      count: 0,
      counts: { relevant: 0, review: 0, outside: 0 },
    };
    cell.count++;
    cell.counts[importance]++;
    counts[importance]++;
    cells.set(key, cell);
    rowTotals.set(a, (rowTotals.get(a) ?? 0) + 1);
    columnTotals.set(b, (columnTotals.get(b) ?? 0) + 1);
  }
  const sort = (a: string, b: string) => a.localeCompare(b, "es");
  return {
    counts,
    cells,
    rowTotals,
    columnTotals,
    rows: [...rowTotals.keys()].sort(sort),
    columns: [...columnTotals.keys()].sort(sort),
  };
}
