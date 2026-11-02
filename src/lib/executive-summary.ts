import type { Clash } from "./clash-types";
import {
  createCoordinationClassifier,
  isPending,
  type CoordinationRules,
} from "./coordination-priority";
import { isHanger } from "./clash-importance";
export const percent = (part: number, total: number) => (total ? (part / total) * 100 : 0);
export function executiveSummary(clashes: Clash[], rules: CoordinationRules) {
  const classify = createCoordinationClassifier(rules);
  const classes = { C1: 0, C2: 0, C3: 0, C4: 0 };
  const statuses = { active: 0, reviewed: 0, resolved: 0, approved: 0 };
  const severity = { alta: 0, media: 0, baja: 0 };
  let resolved = 0,
    approved = 0,
    priorityTotal = 0,
    priorityClosed = 0,
    hangers = 0;
  const tests = new Map<
    string,
    {
      name: string;
      total: number;
      closed: number;
      C1: number;
      C2: number;
      C3: number;
      C4: number;
      pending: number;
      priority: number;
    }
  >();
  for (const clash of clashes) {
    statuses[clash.status]++;
    const classification = classify(clash),
      pending = isPending(clash);
    const priority = classification === "C1" || classification === "C2";
    const test = tests.get(clash.test) ?? {
      name: clash.test,
      total: 0,
      closed: 0,
      C1: 0,
      C2: 0,
      C3: 0,
      C4: 0,
      pending: 0,
      priority: 0,
    };
    test.total++;
    if (priority) priorityTotal++;
    if (pending) {
      severity[clash.severity]++;
      classes[classification]++;
      test[classification]++;
      test.pending++;
      if (priority) test.priority++;
      if (clash.items.some(isHanger)) hangers++;
    } else {
      test.closed++;
      if (priority) priorityClosed++;
      if (clash.status === "resolved") resolved++;
      else approved++;
    }
    tests.set(clash.test, test);
  }
  const pending = Object.values(classes).reduce((a, b) => a + b, 0),
    closed = resolved + approved;
  return {
    total: clashes.length,
    statuses,
    severity,
    pending,
    closed,
    resolved,
    approved,
    classes,
    priority: classes.C1 + classes.C2,
    priorityTotal,
    priorityClosed,
    hangers,
    progress: percent(closed, clashes.length),
    priorityProgress: percent(priorityClosed, priorityTotal),
    tests: [...tests.values()].sort(
      (a, b) => b.priority - a.priority || b.pending - a.pending || a.name.localeCompare(b.name),
    ),
  };
}
export function segmentation(
  clashes: Clash[],
  field: "zona" | "nivel" | "edificio" | "sector" | "contenedor",
) {
  const groups = new Map<string, number>();
  let covered = 0;
  for (const clash of clashes) {
    const value = (clash.filterValues?.[field] || clash[field])?.trim();
    if (
      !value ||
      /^(?:—|-|sin dato|sin nivel|sin zona|sin edificio|sin sector|sin contenedor|<sin nivel>)$/i.test(
        value,
      )
    )
      continue;
    covered++;
    groups.set(value, (groups.get(value) || 0) + 1);
  }
  return {
    covered,
    missing: clashes.length - covered,
    rows: [...groups].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  };
}
