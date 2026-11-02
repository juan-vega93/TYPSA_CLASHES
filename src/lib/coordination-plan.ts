import type { Clash } from "./clash-types";
import {
  summarizeCoordination,
  validCoordinationRules,
  type CoordinationRules,
} from "./coordination-priority";
import { buildResolutionPlan } from "./resolution-plan";
import { clashIdentity } from "./commitment-control";
export interface PlanningRequest {
  ids: string[];
  label: string;
  revision: number;
}
export interface CoordinationPlan {
  id: string;
  title: string;
  cutDate: string;
  createdAt: string;
  startDate: string;
  endDate: string;
  shape: "s" | "linear";
  baseIds: string[];
  baseKeys?: string[];
  baseCount: number;
  rules: CoordinationRules;
  filters: string;
  summary: { C1: number; C2: number; C3: number; C4: number; total: number };
  goals: Record<string, number>;
  actuals: Record<string, number>;
}
export function createCoordinationPlan(
  rows: Clash[],
  title: string,
  cutDate: string,
  rules: CoordinationRules,
  filters: string,
  startDate: string,
  endDate: string,
  shape: "s" | "linear",
): CoordinationPlan {
  const unique = [...new Map(rows.map((row) => [clashIdentity(row), row])).values()];
  if (!unique.length) throw Error("No hay pendientes en el alcance seleccionado.");
  const schedule = buildResolutionPlan(unique.length, 0, { startDate, endDate, shape });
  return {
    id: crypto.randomUUID(),
    title: title.trim() || "Plan de coordinación",
    cutDate,
    createdAt: new Date().toISOString(),
    startDate,
    endDate,
    shape,
    baseIds: unique.map((row) => row.id),
    baseKeys: unique.map(clashIdentity),
    baseCount: unique.length,
    rules: JSON.parse(JSON.stringify(rules)),
    filters,
    summary: summarizeCoordination(unique, rules).total,
    goals: Object.fromEntries(schedule.map((row) => [row.date, row.weekly])),
    actuals: {},
  };
}
export function coordinationSchedule(plan: CoordinationPlan) {
  let cumulative = 0;
  return buildResolutionPlan(plan.baseCount, 0, {
    startDate: plan.startDate,
    endDate: plan.endDate,
    shape: plan.shape,
  }).map((row) => {
    const weekly = plan.goals[row.date] ?? row.weekly;
    cumulative += weekly;
    const actual = plan.actuals[row.date] ?? null;
    return {
      ...row,
      weekly,
      cumulative,
      remaining: plan.baseCount - cumulative,
      actual,
      deviation: actual === null ? null : actual - cumulative,
    };
  });
}
export function planErrors(plan: CoordinationPlan) {
  const errors: string[] = [],
    rows = coordinationSchedule(plan);
  if (rows[0].weekly !== 0)
    errors.push("El primer control representa la base inicial; su meta debe ser cero.");
  if (rows.at(-1)?.cumulative !== plan.baseCount)
    errors.push(`Las metas semanales deben sumar ${plan.baseCount} resultados de la línea base.`);
  let previous = 0;
  for (const row of rows) {
    if (row.actual === null) continue;
    if (!Number.isInteger(row.actual) || row.actual < previous || row.actual > plan.baseCount)
      errors.push(
        `Avance real ${row.label}: usa un acumulado entero, no decreciente y entre 0 y ${plan.baseCount}.`,
      );
    previous = row.actual;
  }
  return errors;
}
export function validCoordinationPlan(value: unknown): value is CoordinationPlan {
  const plan = value as CoordinationPlan;
  if (
    !plan ||
    typeof plan.id !== "string" ||
    typeof plan.title !== "string" ||
    typeof plan.cutDate !== "string" ||
    typeof plan.createdAt !== "string" ||
    typeof plan.filters !== "string" ||
    !validCoordinationRules(plan.rules) ||
    !["s", "linear"].includes(plan.shape) ||
    !Number.isInteger(plan.baseCount) ||
    plan.baseCount < 1 ||
    !Array.isArray(plan.baseIds) ||
    plan.baseIds.length !== plan.baseCount ||
    !plan.baseIds.every((id) => typeof id === "string") ||
    (plan.baseKeys === undefined && new Set(plan.baseIds).size !== plan.baseIds.length)
  )
    return false;
  if (
    plan.baseKeys !== undefined &&
    (!Array.isArray(plan.baseKeys) ||
      plan.baseKeys.length !== plan.baseCount ||
      new Set(plan.baseKeys).size !== plan.baseCount ||
      !plan.baseKeys.every((key, index) => {
        try {
          const pair = JSON.parse(key);
          return (
            Array.isArray(pair) &&
            pair.length === 2 &&
            typeof pair[0] === "string" &&
            pair[1] === plan.baseIds[index]
          );
        } catch {
          return false;
        }
      }))
  )
    return false;
  if (
    !plan.summary ||
    !["C1", "C2", "C3", "C4", "total"].every(
      (key) =>
        Number.isInteger(plan.summary[key as keyof typeof plan.summary]) &&
        plan.summary[key as keyof typeof plan.summary] >= 0,
    ) ||
    plan.summary.total !== plan.baseCount ||
    plan.summary.C1 + plan.summary.C2 + plan.summary.C3 + plan.summary.C4 !== plan.baseCount
  )
    return false;
  try {
    const dates = new Set(
      buildResolutionPlan(plan.baseCount, 0, {
        startDate: plan.startDate,
        endDate: plan.endDate,
      }).map((row) => row.date),
    );
    return [plan.goals, plan.actuals].every(
      (entries) =>
        entries &&
        !Array.isArray(entries) &&
        Object.entries(entries).every(
          ([key, value]) => dates.has(key) && Number.isInteger(value) && value >= 0,
        ),
    );
  } catch {
    return false;
  }
}
export const validPlanList = (value: unknown): value is CoordinationPlan[] =>
  Array.isArray(value) &&
  value.every(validCoordinationPlan) &&
  new Set(value.map((plan) => plan.id)).size === value.length;
