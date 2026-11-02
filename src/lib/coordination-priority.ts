import type { Clash } from "./clash-types";
import { encounterGroup, isHanger } from "./clash-importance";
export type CoordinationClass = "C1" | "C2" | "C3" | "C4";
export interface CoordinationRules {
  priorityCategories: string[];
  openingCategories: string[];
  serviceCategories: string[];
  excludeHangers: boolean;
}
export const CLASS_LABELS: Record<CoordinationClass, string> = {
  C1: "Columnas y cimentaciones prioritarias",
  C2: "Vigas y otras categorías prioritarias",
  C3: "Candidatos a pases / tratamiento agrupado",
  C4: "Otros encuentros por revisar",
};
export const categoryKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
const aliases: Record<string, string> = {
  "structural columns": "pilares estructurales",
  "structural foundations": "cimentacion estructural",
  "structural framing": "armazon estructural",
  floors: "suelos",
  walls: "muros",
  "stair landings": "descansillos",
  "slab edges": "bordes de losa",
  pipes: "tuberias",
  "pipe fittings": "uniones de tuberia",
  "pipe accessories": "accesorios de tuberias",
  ducts: "conductos",
  "duct fittings": "uniones de conducto",
  "cable trays": "bandejas de cables",
  conduits: "tubos",
};
export const canonicalCategory = (value: string) =>
  aliases[categoryKey(value)] ?? categoryKey(value);
export const DEFAULT_COORDINATION_RULES: CoordinationRules = {
  priorityCategories: ["Pilares estructurales", "Cimentación estructural", "Armazón estructural"],
  openingCategories: ["Suelos", "Muros", "Descansillos", "Bordes de losa"],
  serviceCategories: [
    "Tuberías",
    "Uniones de tuberia",
    "Accesorios de tuberías",
    "Conductos",
    "Uniones de conducto",
    "Bandejas de cables",
    "Tubos",
  ],
  excludeHangers: true,
};
export function validCoordinationRules(value: unknown): value is CoordinationRules {
  const rules = value as CoordinationRules;
  return Boolean(
    rules &&
    [rules.priorityCategories, rules.openingCategories, rules.serviceCategories].every(
      (list) => Array.isArray(list) && list.every((item) => typeof item === "string"),
    ) &&
    typeof rules.excludeHangers === "boolean",
  );
}
export function classifyCoordination(clash: Clash, rules: CoordinationRules): CoordinationClass {
  return createCoordinationClassifier(rules)(clash);
}
export function createCoordinationClassifier(rules: CoordinationRules) {
  const categoryCache = new Map<string, string>();
  const canonical = (value: string) => {
    let result = categoryCache.get(value);
    if (result === undefined) {
      result = canonicalCategory(value);
      categoryCache.set(value, result);
    }
    return result;
  };
  const selected = new Set(rules.priorityCategories.map(canonical)),
    surfaces = new Set(rules.openingCategories.map(canonical)),
    services = new Set(rules.serviceCategories.map(canonical));
  return (clash: Clash): CoordinationClass => {
    if (rules.excludeHangers && clash.items.some(isHanger)) return "C4";
    const categories = clash.items.map((item) => canonical(encounterGroup(item)));
    for (let i = 0; i < categories.length; i++) {
      if (!selected.has(categories[i])) continue;
      if (
        ["pilares estructurales", "cimentacion estructural"].includes(categories[i]) ||
        (categories[i] === "armazon estructural" &&
          /viga.*cimentacion|foundation.*beam/.test(categoryKey(clash.items[i].family ?? "")))
      )
        return "C1";
    }
    if (categories.some((category) => selected.has(category))) return "C2";
    if (
      clash.testType === "hard" &&
      !clash.items.some(isHanger) &&
      ((surfaces.has(categories[0]) && services.has(categories[1])) ||
        (surfaces.has(categories[1]) && services.has(categories[0])))
    )
      return "C3";
    return "C4";
  };
}
export const isPending = (clash: Clash) => clash.status === "active" || clash.status === "reviewed";
export const coordinationPair = (clash: Clash) =>
  clash.items.map((item) =>
    isHanger(item) ? `${encounterGroup(item)} · Colgador` : encounterGroup(item),
  );
export function specialtyOf(clash: Clash) {
  const parts = clash.test
    .trim()
    .toUpperCase()
    .replace(/^P\d+\s*[_-]\s*/, "")
    .split(/\s*[_-]\s*/);
  if (parts.length !== 2 || parts.some((part) => !/^[A-Z0-9]+$/.test(part))) return clash.test;
  // A pair has no single owning specialty. Keep both codes and merge reverse-order tests.
  const ordered = parts.includes("EST")
    ? ["EST", parts.find((part) => part !== "EST") ?? "EST"]
    : parts.sort((a, b) => a.localeCompare(b));
  return ordered.join(" × ");
}
export function summarizeCoordination(clashes: Clash[], rules: CoordinationRules) {
  const classify = createCoordinationClassifier(rules);
  const empty = () => ({ C1: 0, C2: 0, C3: 0, C4: 0, total: 0 });
  const total = empty(),
    specialties = new Map<string, ReturnType<typeof empty>>();
  for (const clash of clashes) {
    const group = classify(clash),
      key = specialtyOf(clash),
      row = specialties.get(key) ?? empty();
    row[group]++;
    row.total++;
    total[group]++;
    total.total++;
    specialties.set(key, row);
  }
  return { total, specialties: [...specialties].sort((a, b) => b[1].total - a[1].total) };
}
