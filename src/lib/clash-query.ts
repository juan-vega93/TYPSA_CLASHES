import type { Clash, ClashStatus, Severity } from "./clash-types";

export interface FilterState {
  test?: string;
  status?: string;
  severity?: string;
  zona?: string;
  nivel?: string;
  edificio?: string;
  sector?: string;
  categoria?: string;
  contenedor?: string;
  prioridad?: string;
  search?: string;
}

export type FilterKey = Exclude<keyof FilterState, "search">;

export const FILTER_DEFS: {
  key: FilterKey;
  label: string;
  get: (c: Clash) => string | undefined;
}[] = [
  { key: "test", label: "Test", get: (c) => c.test },
  { key: "status", label: "Estado", get: (c) => c.status },
  { key: "severity", label: "Severidad", get: (c) => c.severity },
  { key: "zona", label: "Zona", get: (c) => c.zona },
  { key: "nivel", label: "Nivel", get: (c) => c.nivel },
  { key: "edificio", label: "Edificio", get: (c) => c.edificio },
  { key: "sector", label: "Sector", get: (c) => c.sector },
  { key: "categoria", label: "Par categ.", get: (c) => c.categoriaPair },
  { key: "contenedor", label: "Contenedor", get: (c) => c.contenedor },
  { key: "prioridad", label: "Prioridad", get: (c) => c.prioridad },
];

export interface ClashIndex {
  byId: Map<string, Clash>;
  allIds: string[];
  filters: Record<FilterKey, Map<string, string[]>>;
  options: Record<FilterKey, string[]>;
  searchText: Map<string, string>;
}

const EMPTY_INDEX: ClashIndex = {
  byId: new Map(),
  allIds: [],
  filters: {
    test: new Map(),
    status: new Map(),
    severity: new Map(),
    zona: new Map(),
    nivel: new Map(),
    edificio: new Map(),
    sector: new Map(),
    categoria: new Map(),
    contenedor: new Map(),
    prioridad: new Map(),
  },
  options: {
    test: [],
    status: [],
    severity: [],
    zona: [],
    nivel: [],
    edificio: [],
    sector: [],
    categoria: [],
    contenedor: [],
    prioridad: [],
  },
  searchText: new Map(),
};

function addToIndex(map: Map<string, string[]>, value: string | undefined, id: string) {
  if (!value || value.trim() === "") return;
  const arr = map.get(value);
  if (arr) arr.push(id);
  else map.set(value, [id]);
}

function buildSearchText(c: Clash) {
  return [
    c.name,
    c.test,
    c.file,
    c.prioridad,
    c.contenedor,
    c.zona,
    c.nivel,
    c.edificio,
    c.sector,
    c.ambiente,
    c.categoriaPair,
    c.familyPair,
    c.typePair,
    c.items[0].elementId,
    c.items[1].elementId,
    c.items[0].family,
    c.items[1].family,
    c.items[0].category,
    c.items[1].category,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function buildClashIndex(clashes: Clash[]): ClashIndex {
  if (clashes.length === 0) return EMPTY_INDEX;

  const filters = Object.fromEntries(
    FILTER_DEFS.map((d) => [d.key, new Map<string, string[]>()])
  ) as ClashIndex["filters"];
  const byId = new Map<string, Clash>();
  const searchText = new Map<string, string>();
  const allIds: string[] = [];

  for (const clash of clashes) {
    byId.set(clash.id, clash);
    allIds.push(clash.id);
    searchText.set(clash.id, buildSearchText(clash));
    for (const def of FILTER_DEFS) addToIndex(filters[def.key], def.get(clash), clash.id);
  }

  const options = Object.fromEntries(
    FILTER_DEFS.map((d) => [
      d.key,
      Array.from(filters[d.key].keys()).sort((a, b) => a.localeCompare(b)),
    ])
  ) as ClashIndex["options"];

  return { byId, allIds, filters, options, searchText };
}

function selectedFilterEntries(filters: FilterState) {
  return FILTER_DEFS.map((d) => [d.key, filters[d.key]] as const).filter(
    ([, value]) => value && value !== "__all__"
  );
}

function materialize(index: ClashIndex, ids: string[]) {
  const out: Clash[] = [];
  for (const id of ids) {
    const clash = index.byId.get(id);
    if (clash) out.push(clash);
  }
  return out;
}

export function queryClashes(index: ClashIndex, filters: FilterState): Clash[] {
  const active = selectedFilterEntries(filters);
  let ids: string[];

  if (active.length === 0) {
    ids = index.allIds;
  } else {
    active.sort((a, b) => {
      const aLen = index.filters[a[0]].get(a[1]!)?.length ?? 0;
      const bLen = index.filters[b[0]].get(b[1]!)?.length ?? 0;
      return aLen - bLen;
    });
    const [firstKey, firstValue] = active[0];
    ids = index.filters[firstKey].get(firstValue!) ?? [];
    for (let i = 1; i < active.length; i += 1) {
      const [key, value] = active[i];
      const allowed = new Set(index.filters[key].get(value!) ?? []);
      ids = ids.filter((id) => allowed.has(id));
      if (ids.length === 0) break;
    }
  }

  const q = filters.search?.trim().toLowerCase();
  if (q) ids = ids.filter((id) => index.searchText.get(id)?.includes(q));

  return materialize(index, ids);
}

export interface ClashMetrics {
  total: number;
  pending: number;
  resolved: number;
  alta: number;
  avgPen: number;
  withElementId: number;
  byStatus: Record<ClashStatus, number>;
  bySeverity: Record<Severity, number>;
}

export function summarizeClashes(clashes: Clash[]): ClashMetrics {
  const metrics: ClashMetrics = {
    total: clashes.length,
    pending: 0,
    resolved: 0,
    alta: 0,
    avgPen: 0,
    withElementId: 0,
    byStatus: { active: 0, reviewed: 0, approved: 0, resolved: 0 },
    bySeverity: { alta: 0, media: 0, baja: 0 },
  };
  let distance = 0;
  for (const c of clashes) {
    if (c.status === "active") metrics.pending += 1;
    else metrics.resolved += 1;
    if (c.severity === "alta") metrics.alta += 1;
    if (c.items[0].elementId && c.items[0].elementId !== "sin ID") metrics.withElementId += 1;
    metrics.byStatus[c.status] += 1;
    metrics.bySeverity[c.severity] += 1;
    distance += c.distance;
  }
  metrics.avgPen = clashes.length === 0 ? 0 : distance / clashes.length;
  return metrics;
}

export function getGlobalBounds(clashes: Clash[]) {
  let hasPoint = false;
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  for (const c of clashes) {
    if (c.pos.x === 0 && c.pos.y === 0) continue;
    hasPoint = true;
    xMin = Math.min(xMin, c.pos.x);
    xMax = Math.max(xMax, c.pos.x);
    yMin = Math.min(yMin, c.pos.y);
    yMax = Math.max(yMax, c.pos.y);
  }

  if (!hasPoint) return { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
  const xPad = Math.max(1, (xMax - xMin) * 0.05);
  const yPad = Math.max(1, (yMax - yMin) * 0.05);
  return { xMin: xMin - xPad, xMax: xMax + xPad, yMin: yMin - yPad, yMax: yMax + yPad };
}
