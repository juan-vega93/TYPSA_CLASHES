import type { Clash, ClashSnapshot } from "./clash-types";
import { isPending } from "./coordination-priority";
export const clashIdentity = (clash: Pick<Clash, "test" | "id">) =>
  JSON.stringify([clash.test, clash.id]);
export const MOVEMENT_LABELS = {
  new: "Nuevos pendientes",
  reopened: "Reabiertos",
  returned: "Reaparecidos sin cierre previo",
  closed: "Cierres por estado XML",
  missing: "No localizados",
  coverageIn: "Cobertura incorporada",
  coverageOut: "Cobertura retirada",
  scopeIn: "Ingreso por reclasificación / filtro",
  scopeOut: "Salida por reclasificación / filtro",
};
export type MovementKind = keyof typeof MOVEMENT_LABELS;
export interface Movement {
  kind: MovementKind;
  key: string;
  test: string;
  id: string;
  name: string;
  before?: string;
  after?: string;
  delta: number;
}
export interface CutBalance {
  key: string;
  date: string;
  fromDate?: string;
  label: string;
  total: number;
  pending: number;
  closed: number;
  opening: number;
  delta: number;
  counts: Record<MovementKind, number>;
  events: Movement[];
  initial: boolean;
  duplicates: number;
  byTest?: Record<
    string,
    { opening: number; pending: number; counts: Record<MovementKind, number> }
  >;
}
const counts = (): Record<MovementKind, number> => ({
  new: 0,
  reopened: 0,
  returned: 0,
  closed: 0,
  missing: 0,
  coverageIn: 0,
  coverageOut: 0,
  scopeIn: 0,
  scopeOut: 0,
});
export function reconcileSnapshots(
  snapshots: ClashSnapshot[],
  include: (row: Clash) => boolean = () => true,
  options: { details?: boolean } = {},
): CutBalance[] {
  let previous = new Map<string, Clash>();
  const seen = new Map<string, Clash>();
  const output: CutBalance[] = [];
  for (const snapshot of [...snapshots].sort(
    (a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key),
  )) {
    const current = new Map(snapshot.clashes.map((row) => [clashIdentity(row), row]));
    const previousTests = new Set([...previous.values()].map((row) => row.test));
    const currentTests = new Set([...current.values()].map((row) => row.test));
    const scoped = [...current.values()].filter(include);
    const balance: CutBalance = {
      key: snapshot.key,
      date: snapshot.date,
      fromDate: output.at(-1)?.date,
      label: snapshot.label,
      total: scoped.length,
      pending: scoped.filter(isPending).length,
      closed: scoped.filter((row) => !isPending(row)).length,
      opening: output.at(-1)?.pending ?? scoped.filter(isPending).length,
      delta: 0,
      counts: counts(),
      events: [],
      initial: !output.length,
      duplicates: snapshot.clashes.length - current.size,
      byTest: Object.create(null),
    };
    const testBalance = (test: string) =>
      (balance.byTest![test] ??= {
        opening: 0,
        pending: 0,
        counts: counts(),
      });
    for (const row of scoped) if (isPending(row)) testBalance(row.test).pending++;
    for (const row of previous.values())
      if (include(row) && isPending(row)) testBalance(row.test).opening++;
    if (balance.initial)
      for (const value of Object.values(balance.byTest!)) value.opening = value.pending;
    let movementDelta = 0;
    const event = (
      kind: MovementKind,
      row: Clash,
      delta: number,
      before?: Clash,
      after?: Clash,
    ) => {
      balance.counts[kind]++;
      testBalance(row.test).counts[kind]++;
      movementDelta += delta;
      if (options.details !== false)
        balance.events.push({
          kind,
          key: clashIdentity(row),
          test: row.test,
          id: row.id,
          name: row.name,
          before: before?.status,
          after: after?.status,
          delta,
        });
    };
    if (output.length) {
      for (const [key, row] of previous) {
        if (!include(row) || !isPending(row)) continue;
        const next = current.get(key);
        if (!next) event(currentTests.has(row.test) ? "missing" : "coverageOut", row, -1, row);
        else if (!isPending(next)) event("closed", next, -1, row, next);
        else if (!include(next)) event("scopeOut", next, -1, row, next);
      }
      for (const [key, row] of current) {
        if (!include(row) || !isPending(row)) continue;
        const before = previous.get(key);
        if (before) {
          if (!isPending(before)) event("reopened", row, 1, before, row);
          else if (!include(before)) event("scopeIn", row, 1, before, row);
        } else if (!previousTests.has(row.test)) event("coverageIn", row, 1, seen.get(key), row);
        else if (seen.has(key))
          event(isPending(seen.get(key)!) ? "returned" : "reopened", row, 1, seen.get(key), row);
        else event("new", row, 1, undefined, row);
      }
    }
    balance.delta = balance.pending - balance.opening;
    if (movementDelta !== balance.delta) throw Error("El balance de movimientos no concilia.");
    output.push(balance);
    for (const [key, row] of current) seen.set(key, row);
    previous = current;
  }
  return output;
}
export function movementTotals(cut: CutBalance) {
  const entries =
    cut.counts.new +
    cut.counts.reopened +
    cut.counts.returned +
    cut.counts.coverageIn +
    cut.counts.scopeIn;
  const otherExits = cut.counts.missing + cut.counts.coverageOut + cut.counts.scopeOut;
  return { entries, otherExits };
}
export function periodNarrative(cut: CutBalance): string[] {
  if (cut.initial)
    return [
      "Este es el primer corte disponible; no hay movimientos comparables del período anterior.",
    ];
  const { entries, otherExits } = movementTotals(cut);
  const n = (value: number) => value.toLocaleString("es-PE");
  return [
    `Entre ${cut.fromDate} y ${cut.date}: ${n(cut.counts.closed)} cierres por estado XML y ${n(entries)} entradas al inventario.`,
    `${n(otherExits)} salidas por ausencia o cambio de alcance; no se acreditan como resolución.`,
    `El pendiente pasó de ${n(cut.opening)} a ${n(cut.pending)}: ${cut.delta > 0 ? `aumentó en ${n(cut.delta)}` : cut.delta < 0 ? `disminuyó en ${n(-cut.delta)}` : "se mantuvo sin cambio neto"}.`,
  ];
}
export function baselineMembership(
  baseIds: string[],
  baseKeys: string[] | undefined,
  base: ClashSnapshot | undefined,
  current: ClashSnapshot | undefined,
) {
  const byId = new Map<string, Clash[]>();
  if (!baseKeys)
    for (const row of base?.clashes ?? []) byId.set(row.id, [...(byId.get(row.id) ?? []), row]);
  const keys =
    baseKeys ??
    baseIds.flatMap((id) => {
      const matches = byId.get(id) ?? [];
      return matches.length === 1 ? [clashIdentity(matches[0])] : [];
    });
  const now = new Map((current?.clashes ?? []).map((row) => [clashIdentity(row), row]));
  let pending = 0,
    closed = 0,
    missing = 0;
  for (const key of keys) {
    const row = now.get(key);
    if (!row) missing++;
    else if (isPending(row)) pending++;
    else closed++;
  }
  return { keys, pending, closed, missing, unmatched: baseIds.length - keys.length };
}
export interface ForecastVersion {
  id: string;
  createdAt: string;
  planId: string;
  cutKey: string;
  cutDate: string;
  pending: number;
  closuresPerWeek: number;
  arrivalsPerWeek: number;
  scope: string;
}
export function forecastPoints(version: ForecastVersion) {
  const net = version.closuresPerWeek - version.arrivalsPerWeek;
  const weeks = version.pending === 0 ? 0 : net > 0 ? Math.ceil(version.pending / net) : null;
  const horizon = Math.min(weeks ?? 12, 104);
  const points = Array.from({ length: horizon + 1 }, (_, i) => ({
    date: new Date(Date.parse(version.cutDate + "T00:00:00Z") + i * 7 * 86400000)
      .toISOString()
      .slice(0, 10),
    value: Math.max(0, version.pending - i * net),
  }));
  return {
    points,
    weeks,
    completion:
      weeks !== null
        ? new Date(Date.parse(version.cutDate + "T00:00:00Z") + weeks * 7 * 86400000)
            .toISOString()
            .slice(0, 10)
        : null,
    truncated: weeks !== null && weeks > 104,
  };
}
export const validForecasts = (value: unknown): value is ForecastVersion[] =>
  Array.isArray(value) &&
  value.every(
    (v) =>
      v &&
      typeof v.id === "string" &&
      typeof v.scope === "string" &&
      typeof v.planId === "string" &&
      typeof v.cutKey === "string" &&
      typeof v.createdAt === "string" &&
      Number.isFinite(Date.parse(v.createdAt)) &&
      /^\d{4}-\d{2}-\d{2}$/.test(v.cutDate) &&
      Number.isFinite(Date.parse(v.cutDate)) &&
      new Date(v.cutDate).toISOString().slice(0, 10) === v.cutDate &&
      [v.pending, v.closuresPerWeek, v.arrivalsPerWeek].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ),
  ) &&
  new Set(value.map((v) => v.id)).size === value.length;
