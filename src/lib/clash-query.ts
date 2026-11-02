import type { Clash, ClashStatus, Severity } from "./clash-types";
import { getProjectField, getRuntimeFilterFields, type ProjectConfig } from "./project-config";
import { normalizeLevel } from "./clash-levels";
import { clashIdentity } from "./commitment-control";

export type LevelSource = "primary" | "a" | "b" | "either";
export const MISSING_LEVEL = "__missing_level__";
export interface FilterState extends Record<string, string | string[] | undefined> {
  search?: string;
  nivel?: string | string[];
  nivelSource?: LevelSource;
}

export type FilterKey = string;

export interface RuntimeFilterDef {
  key: string;
  label: string;
  get: (c: Clash) => string | undefined;
}

export function buildFilterDefs(config: ProjectConfig): RuntimeFilterDef[] {
  const runtimeFields = new Map(getRuntimeFilterFields(config).map((field) => [field.key, field]));
  return [
    { key: "test", label: getProjectField(config, "test").label, get: (c) => c.test },
    { key: "status", label: getProjectField(config, "estado").label, get: (c) => c.status },
    { key: "severity", label: getProjectField(config, "severity").label, get: (c) => c.severity },
    fieldFilterDef(runtimeFields, "zona", (c) => c.zona),
    fieldFilterDef(runtimeFields, "nivel", (c) => c.nivel),
    fieldFilterDef(runtimeFields, "edificio", (c) => c.edificio),
    fieldFilterDef(runtimeFields, "sector", (c) => c.sector),
    {
      key: "categoria",
      label: getProjectField(config, "categoria").label,
      get: (c) => c.categoriaPair,
    },
    fieldFilterDef(runtimeFields, "contenedor", (c) => c.contenedor),
    {
      key: "prioridad",
      label: getProjectField(config, "prioridad").label,
      get: (c) => c.prioridad,
    },
  ];
}

function fieldFilterDef(
  fields: Map<string, { key: string; label: string }>,
  key: string,
  fallback: (c: Clash) => string | undefined,
): RuntimeFilterDef {
  const field = fields.get(key);
  if (!field) throw new Error(`Missing runtime filter field config: ${key}`);
  return {
    key,
    label: field.label,
    get: (c) => {
      const value = c.filterValues?.[key] || fallback(c);
      return key === "nivel" ? normalizeLevel(value) : value;
    },
  };
}

export interface ClashIndex {
  byId: Map<string, Clash>;
  allIds: string[];
  filterDefs: RuntimeFilterDef[];
  filters: Record<string, Map<string, string[]>>;
  options: Record<string, string[]>;
  searchText: Map<string, string>;
  levels: Record<LevelSource, Map<string, string[]>>;
  levelOptions: Record<LevelSource, string[]>;
}

function emptyIndex(filterDefs: RuntimeFilterDef[]): ClashIndex {
  return {
    byId: new Map(),
    allIds: [],
    filterDefs,
    filters: Object.fromEntries(filterDefs.map((d) => [d.key, new Map<string, string[]>()])),
    options: Object.fromEntries(filterDefs.map((d) => [d.key, []])),
    searchText: new Map(),
    levels: { primary: new Map(), a: new Map(), b: new Map(), either: new Map() },
    levelOptions: { primary: [], a: [], b: [], either: [] },
  };
}

function addToIndex(map: Map<string, string[]>, value: string | undefined, id: string) {
  if (!value || value.trim() === "") return;
  const arr = map.get(value);
  if (arr) arr.push(id);
  else map.set(value, [id]);
}

export function buildSearchText(c: Clash) {
  if (c.searchText !== undefined) return c.searchText;
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
    ...Object.values(c.filterValues ?? {}),
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

/** Single-pass historical filtering, without building ten inverted indexes. */
export function compileClashFilter(config: ProjectConfig, filters: FilterState) {
  const active = buildFilterDefs(config).flatMap((def) => {
    const value = filters[def.key];
    if (value === undefined || value === "" || value === "__all__") return [];
    return [
      {
        def,
        values: new Set(
          (Array.isArray(value) ? value : [value]).map((v) =>
            def.key === "nivel" ? (normalizeLevel(v) ?? v) : v,
          ),
        ),
      },
    ];
  });
  const search = filters.search?.trim().toLowerCase();
  return (clash: Clash) => {
    for (const { def, values } of active) {
      if (def.key === "nivel") {
        const primary = normalizeLevel(clash.filterValues?.nivel || clash.nivel);
        const a = normalizeLevel(clash.items[0].nivel),
          b = normalizeLevel(clash.items[1].nivel);
        const source = filters.nivelSource ?? "either";
        const levels =
          source === "a"
            ? [a]
            : source === "b"
              ? [b]
              : source === "primary"
                ? [primary]
                : a || b
                  ? [a, b].filter(Boolean)
                  : [primary];
        if (!levels.some((level) => values.has(level ?? MISSING_LEVEL))) return false;
      } else {
        const value = def.get(clash);
        if (!value || !values.has(value)) return false;
      }
    }
    return !search || buildSearchText(clash).includes(search);
  };
}

export function buildClashIndex(clashes: Clash[], config: ProjectConfig): ClashIndex {
  const filterDefs = buildFilterDefs(config);
  if (clashes.length === 0) return emptyIndex(filterDefs);

  const filters = Object.fromEntries(
    filterDefs.map((d) => [d.key, new Map<string, string[]>()]),
  ) as ClashIndex["filters"];
  const byId = new Map<string, Clash>();
  const searchText = new Map<string, string>();
  const allIds: string[] = [];
  const levels: ClashIndex["levels"] = {
    primary: new Map(),
    a: new Map(),
    b: new Map(),
    either: new Map(),
  };

  for (const clash of clashes) {
    const identity = clashIdentity(clash);
    byId.set(identity, clash);
    allIds.push(identity);
    searchText.set(identity, buildSearchText(clash));
    for (const def of filterDefs) addToIndex(filters[def.key], def.get(clash), identity);
    const primary = normalizeLevel(clash.filterValues?.nivel || clash.nivel);
    const a = normalizeLevel(clash.items[0].nivel);
    const b = normalizeLevel(clash.items[1].nivel);
    const either = [...new Set([a, b].filter((level): level is string => Boolean(level)))];
    if (!either.length && primary) either.push(primary);
    const values: Record<LevelSource, string[]> = {
      primary: [primary ?? MISSING_LEVEL],
      a: [a ?? MISSING_LEVEL],
      b: [b ?? MISSING_LEVEL],
      either: either.length ? either : [MISSING_LEVEL],
    };
    for (const source of Object.keys(levels) as LevelSource[]) {
      for (const level of values[source]) addToIndex(levels[source], level, identity);
    }
  }

  const options = Object.fromEntries(
    filterDefs.map((d) => [
      d.key,
      Array.from(filters[d.key].keys()).sort((a, b) => a.localeCompare(b)),
    ]),
  ) as ClashIndex["options"];

  const optionsFor = (buckets: ClashIndex["levels"]) =>
    Object.fromEntries(
      (Object.keys(buckets) as LevelSource[]).map((source) => [
        source,
        [...buckets[source].keys()].sort((a, b) => a.localeCompare(b, "es", { numeric: true })),
      ]),
    ) as ClashIndex["levelOptions"];
  return {
    byId,
    allIds,
    filterDefs,
    filters,
    options,
    searchText,
    levels,
    levelOptions: optionsFor(levels),
  };
}

function selectedFilterEntries(index: ClashIndex, filters: FilterState) {
  return index.filterDefs
    .map((d) => [d.key, filters[d.key]] as const)
    .filter(
      (entry): entry is readonly [string, string | string[]] =>
        entry[1] !== undefined && entry[1] !== "" && entry[1] !== "__all__",
    )
    .map(([key, value]) => [key, Array.isArray(value) ? value : [value]] as const);
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
  const active = selectedFilterEntries(index, filters);
  const candidates = active.map(([key, values]) => {
    const buckets =
      key === "nivel" ? index.levels[filters.nivelSource ?? "either"] : index.filters[key];
    // OR within one field; the intersection below applies AND between fields.
    return new Set(
      values.flatMap((value) => {
        const normalized = key === "nivel" ? (normalizeLevel(value) ?? value) : value;
        return buckets.get(normalized) ?? [];
      }),
    );
  });
  let ids: string[];

  if (candidates.length === 0) {
    ids = index.allIds;
  } else {
    candidates.sort((a, b) => a.size - b.size);
    ids = [...candidates[0]];
    for (let i = 1; i < candidates.length; i += 1) {
      ids = ids.filter((id) => candidates[i].has(id));
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
    if (c.status === "active" || c.status === "reviewed") metrics.pending += 1;
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
