import { buildResolutionPlan } from "./resolution-plan";

export interface WeeklyReplan {
  id: string;
  planId: string;
  createdAt: string;
  anchorDate: string;
  anchorClosed: number;
  pending: number;
  endDate: string;
  history: { date: string; closed: number }[];
  goals: Record<string, number>;
  actuals: Record<string, number>;
}
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
export function createWeeklyReplan(
  planId: string,
  history: WeeklyReplan["history"],
  pending: number,
  endDate: string,
  distribute: boolean,
) {
  const anchor = history.at(-1);
  if (!anchor || !integer(pending) || !pending) throw Error("No hay pendientes para reprogramar.");
  const dates = buildResolutionPlan(pending, 0, {
    startDate: anchor.date,
    endDate,
    shape: "linear",
  }).slice(1);
  const version = {
    id: crypto.randomUUID(),
    planId,
    createdAt: new Date().toISOString(),
    anchorDate: anchor.date,
    anchorClosed: anchor.closed,
    pending,
    endDate,
    history: history.map((row) => ({ ...row })),
    goals: Object.fromEntries(dates.map((row) => [row.date, distribute ? row.weekly : 0])),
    actuals: {},
  } satisfies WeeklyReplan;
  if (!validWeeklyReplans([version])) throw Error("El historial no es válido para reprogramar.");
  return version;
}
export function weeklyReplanSchedule(version: WeeklyReplan) {
  let target = version.anchorClosed;
  return Object.keys(version.goals)
    .sort()
    .map((date) => {
      target += version.goals[date];
      const actual = version.actuals[date] ?? null;
      return {
        date,
        weekly: version.goals[date],
        target,
        actual,
        deviation: actual === null ? null : actual - target,
      };
    });
}
export function weeklyReplanErrors(version: WeeklyReplan) {
  const errors: string[] = [];
  const assigned = Object.values(version.goals).reduce((sum, value) => sum + value, 0);
  if (assigned !== version.pending)
    errors.push(
      assigned < version.pending
        ? `Faltan asignar ${version.pending - assigned} cierres a las semanas futuras.`
        : `Las metas superan el pendiente en ${assigned - version.pending} cierres.`,
    );
  let previous = version.anchorClosed;
  for (const row of weeklyReplanSchedule(version)) {
    if (row.actual === null) continue;
    if (
      !integer(row.actual) ||
      row.actual < previous ||
      row.actual > version.anchorClosed + version.pending
    )
      errors.push(
        `Avance ${row.date}: usa un acumulado no decreciente entre ${previous} y ${version.anchorClosed + version.pending}.`,
      );
    previous = row.actual;
  }
  return errors;
}
export function validWeeklyReplans(value: unknown): value is WeeklyReplan[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((v: WeeklyReplan) => {
    try {
      if (
        !v ||
        typeof v.id !== "string" ||
        ids.has(v.id) ||
        typeof v.planId !== "string" ||
        typeof v.createdAt !== "string" ||
        !Number.isFinite(Date.parse(v.createdAt)) ||
        !integer(v.anchorClosed) ||
        !integer(v.pending) ||
        !v.pending ||
        !Array.isArray(v.history) ||
        !v.history.length
      )
        return false;
      ids.add(v.id);
      const dates = buildResolutionPlan(v.pending, 0, {
        startDate: v.anchorDate,
        endDate: v.endDate,
      })
        .slice(1)
        .map((row) => row.date);
      const anchor = v.history.at(-1)!;
      if (
        anchor.date !== v.anchorDate ||
        anchor.closed !== v.anchorClosed ||
        v.history.some(
          (r, i) =>
            !integer(r.closed) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
            !Number.isFinite(Date.parse(r.date)) ||
            new Date(r.date).toISOString().slice(0, 10) !== r.date ||
            (i > 0 && (r.date <= v.history[i - 1].date || r.closed < v.history[i - 1].closed)),
        )
      )
        return false;
      if (
        !v.goals ||
        !v.actuals ||
        typeof v.goals !== "object" ||
        typeof v.actuals !== "object" ||
        Array.isArray(v.goals) ||
        Array.isArray(v.actuals) ||
        Object.keys(v.goals).length !== dates.length
      )
        return false;
      return (
        dates.every((date) => integer(v.goals[date])) &&
        Object.entries(v.actuals).every(([date, actual]) => dates.includes(date) && integer(actual))
      );
    } catch {
      return false;
    }
  });
}
