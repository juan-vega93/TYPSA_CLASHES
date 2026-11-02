import type { Clash } from "./clash-types";
import type { ClashOverride } from "./use-clash-state";
import {
  classifyImportance,
  encounterGroup,
  IMPORTANCE_LABELS,
  isHanger,
} from "./clash-importance";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const openingSurfaces = new Set([
  "suelos",
  "floors",
  "muros",
  "walls",
  "descansillos",
  "stair landings",
  "bordes de losa",
  "slab edges",
]);
const services = new Set([
  "tuberias",
  "pipes",
  "uniones de tuberia",
  "pipe fittings",
  "accesorios de tuberias",
  "pipe accessories",
  "conductos",
  "ducts",
  "uniones de conducto",
  "duct fittings",
  "bandejas de cables",
  "cable trays",
  "tubos",
  "conduits",
]);

export function isOpeningCandidate(clash: Clash) {
  if (clash.testType?.toLowerCase() !== "hard" || clash.items.some(isHanger)) return false;
  const [a, b] = clash.items.map((item) => normalize(encounterGroup(item)));
  return (openingSurfaces.has(a) && services.has(b)) || (openingSurfaces.has(b) && services.has(a));
}

export function reviewReportCsv(
  rows: Clash[],
  overrides: Record<string, ClashOverride>,
  options: {
    cutDate?: string;
    includeHighSeverity: boolean;
    excludeHangers: boolean;
    scope?: string;
  },
) {
  const headers = [
    "Corte",
    "Test",
    "Archivo XML",
    "GUID",
    "Unidad",
    "Conflicto",
    "Estado XML",
    "Estado actual",
    "Criterio",
    "Relevancia",
    "Motivo",
    "Posible pase",
    "Categoría A",
    "Categoría B",
    "Familia A",
    "Familia B",
    "ID A",
    "ID B",
    "Nivel A",
    "Origen nivel A",
    "Nivel original A",
    "Nivel B",
    "Origen nivel B",
    "Nivel original B",
    "Tipo de test",
    "Tolerancia m",
    "Distancia firmada m",
    "Rejilla",
    "X",
    "Y",
    "Z",
    "Responsable",
    "Nota",
    "Filtros del reporte",
  ];
  const source = { property: "Nivel", reference: "Nivel de referencia", layer: "Capa" };
  const records: unknown[][] = [headers];
  for (const clash of rows) {
    const classification = classifyImportance(
      clash,
      options.excludeHangers,
      options.includeHighSeverity,
    );
    records.push([
      options.cutDate ?? clash.snapshotDate ?? "",
      clash.test,
      clash.file,
      clash.id,
      clash.kind === "group" ? "Grupo (1 resultado)" : "Individual",
      clash.name,
      clash.sourceStatus ?? clash.status,
      overrides[clash.id]?.status ?? clash.status,
      options.includeHighSeverity ? "Estructura + severidad alta" : "Estructura",
      IMPORTANCE_LABELS[classification.importance],
      classification.reason,
      isOpeningCandidate(clash)
        ? "Candidato por categorías; verificar diseño y geometría"
        : "No identificado por esta regla",
      ...clash.items.map(encounterGroup),
      ...clash.items.map((item) => item.family ?? ""),
      ...clash.items.map((item) => item.elementId ?? ""),
      clash.items[0].nivel ?? "",
      source[clash.items[0].nivelSource!] ?? "Sin dato",
      clash.items[0].nivelRaw ?? "",
      clash.items[1].nivel ?? "",
      source[clash.items[1].nivelSource!] ?? "Sin dato",
      clash.items[1].nivelRaw ?? "",
      clash.testType ?? "",
      clash.testTolerance ?? "",
      clash.signedDistance,
      clash.gridlocation ?? "",
      clash.pos.x,
      clash.pos.y,
      clash.pos.z,
      overrides[clash.id]?.assignee ?? "",
      overrides[clash.id]?.note ?? "",
      options.scope ?? "",
    ]);
  }
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (typeof value !== "number" && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + records.map((row) => row.map(cell).join(",")).join("\r\n");
}
