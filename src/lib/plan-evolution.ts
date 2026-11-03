import type { ClashSnapshot } from "./clash-types";
import type { CoordinationPlan } from "./coordination-plan";
import { coordinationSchedule } from "./coordination-plan";
import { compileClashFilter, type FilterState } from "./clash-query";
import type { ProjectConfig } from "./project-config";
import { createCoordinationClassifier, isPending } from "./coordination-priority";
import { clashIdentity, reconcileSnapshots, movementTotals } from "./commitment-control";
import { lineChart } from "./commitment-export";
import { weeklyReplanErrors, weeklyReplanSchedule, type WeeklyReplan } from "./weekly-replan";

export function planEvolutionHistory(
  plan: Pick<CoordinationPlan, "rules" | "filters" | "cutDate" | "baseIds" | "baseKeys">,
  snapshots: ClashSnapshot[],
  config: ProjectConfig,
) {
  const metadata = JSON.parse(plan.filters || "{}");
  const source = metadata.source;
  const classify = createCoordinationClassifier(plan.rules);
  const classes =
    metadata.classes ??
    (source === "priority"
      ? ["C1", "C2"]
      : source === "passes"
        ? ["C3"]
        : ["C1", "C2", "C3", "C4"]);
  const matches = compileClashFilter(
    config,
    source === "cut" ? {} : ((metadata.filters ?? {}) as FilterState),
  );
  const included = new WeakMap<ClashSnapshot["clashes"][number], boolean>();
  const include = (row: ClashSnapshot["clashes"][number]) => {
    const cached = included.get(row);
    if (cached !== undefined) return cached;
    const result = matches(row) && classes.includes(classify(row));
    included.set(row, result);
    return result;
  };
  const cuts = snapshots
    .filter((s) => s.date >= plan.cutDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (cuts[0]?.date !== plan.cutDate)
    throw Error("Incluye el corte de la base en el período y pulsa Generar período.");
  const keys = new Set(plan.baseKeys ?? plan.baseIds);
  const initialKeys = new Set(
    cuts[0].clashes
      .filter((row) => include(row) && isPending(row))
      .map((row) => (plan.baseKeys ? clashIdentity(row) : row.id)),
  );
  if (
    source === "selection" ||
    keys.size !== initialKeys.size ||
    [...keys].some((key) => !initialKeys.has(key))
  )
    throw Error(
      "El alcance del corte no coincide con los resultados de este plan. Crea una base desde el corte histórico elegido con el alcance total o C1+C2; las selecciones puntuales se conservan en el plan original.",
    );
  const balances = reconcileSnapshots(cuts, include, { details: false });
  let closed = 0,
    entries = 0,
    exits = 0;
  const rows = balances.map((cut) => {
    closed += cut.counts.closed;
    const totals = movementTotals(cut);
    entries += totals.entries;
    exits += totals.otherExits;
    return {
      date: cut.date,
      closed,
      entries,
      exits,
      pending: cut.pending,
    };
  });
  return rows;
}

export function planEvolution(
  plan: CoordinationPlan,
  snapshots: ClashSnapshot[],
  config: ProjectConfig,
  progressSource: "xml" | "manual" = "xml",
  rows = planEvolutionHistory(plan, snapshots, config),
  replan?: WeeklyReplan,
) {
  const schedule = coordinationSchedule(plan);
  const dates = [
    ...new Set([...schedule.map((row) => row.date), ...rows.map((row) => row.date)]),
  ].sort();
  let scheduleIndex = 0;
  const originalAt = (date: string) => {
    while (scheduleIndex + 1 < schedule.length && schedule[scheduleIndex + 1].date <= date)
      scheduleIndex++;
    const before = schedule[scheduleIndex]?.date <= date ? schedule[scheduleIndex] : undefined;
    const after = before ? schedule[scheduleIndex + 1] : schedule[0];
    if (!before) return 0;
    if (!after) return before.cumulative;
    const progress =
      (Date.parse(date) - Date.parse(before.date)) /
      (Date.parse(after.date) - Date.parse(before.date));
    return before.cumulative + (after.cumulative - before.cumulative) * progress;
  };
  let adjustment = 0;
  const rowsByDate = new Map(rows.map((row) => [row.date, row]));
  const adjusted = dates.flatMap((date) => {
    const original = originalAt(date);
    const cut = rowsByDate.get(date);
    const next = cut ? cut.entries - cut.exits : adjustment;
    const points = [{ date, value: Math.max(0, original + adjustment) }];
    if (next !== adjustment) points.push({ date, value: Math.max(0, original + next) });
    adjustment = next;
    return points;
  });
  const latest = rows.at(-1)!;
  const workload = plan.baseCount + latest.entries - latest.exits;
  const future = replan ? weeklyReplanSchedule(replan) : [];
  const manualPoints = replan
    ? [
        ...replan.history.map((row) => ({ date: row.date, value: row.closed })),
        ...future
          .filter((row) => row.actual !== null)
          .map((row) => ({ date: row.date, value: row.actual! })),
      ]
    : schedule
        .filter((row) => row.actual !== null)
        .map((row) => ({ date: row.date, value: row.actual! }));
  const svg = lineChart("CURVA ORIGINAL, CARGA ADICIONAL Y CIERRES", [
    {
      name: "Plan original acumulado",
      color: "#64748b",
      dashed: true,
      points: schedule.map((row) => ({ date: row.date, value: row.cumulative })),
    },
    {
      name: replan
        ? `Metas futuras desde ${replan.anchorDate} (editables)`
        : "Referencia ajustada por entradas y otras salidas (no es una nueva promesa)",
      color: replan ? "#7c3aed" : "#d97706",
      points: replan
        ? [
            { date: replan.anchorDate, value: replan.anchorClosed },
            ...future.map((row) => ({ date: row.date, value: row.target })),
          ]
        : adjusted,
    },
    {
      name:
        progressSource === "xml"
          ? "Cierres realizados acumulados (XML)"
          : replan
            ? "Historial XML y avance futuro manual"
            : `Avance real manual de la base${manualPoints.length ? "" : " · sin registros"}`,
      color: "#059669",
      points:
        progressSource === "xml"
          ? rows.map((row) => ({ date: row.date, value: row.closed }))
          : manualPoints,
    },
  ]);
  return { rows, svg, workload, latest, progressSource, manualPoints, replan };
}

export function evolutionReportPages(
  plan: CoordinationPlan,
  evolution: ReturnType<typeof planEvolution>,
) {
  const esc = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const n = (value: number) => value.toLocaleString("es-PE");
  const manual = evolution.manualPoints.at(-1);
  const sourceIsHistory = evolution.replan && !Object.keys(evolution.replan.actuals).length;
  const progressNote =
    evolution.progressSource === "manual"
      ? sourceIsHistory
        ? `Línea verde: historial XML hasta ${evolution.replan!.anchorDate}; avance futuro manual sin registros.`
        : manual
          ? `Línea verde: avance manual ${n(manual.value)} al ${manual.date}; XML observado hasta ${evolution.latest.date}.`
          : "Línea verde: avance manual sin registros; no se inventan valores ni se copian cierres XML."
      : `Línea verde: cierres XML acumulados hasta ${evolution.latest.date}; avance manual guardado aparte.`;
  const output: string[] = [];
  for (let offset = 0; offset < evolution.rows.length;) {
    const first = offset === 0;
    const tableY = first ? 1000 : 230;
    const x = [60, 260, 430, 630, 830, 1010];
    const header = ["Corte", "Base", "Cierres XML", "Entradas", "Otras salidas", "Pendientes"];
    const pageRows = evolution.rows.slice(offset, offset + (first ? 14 : 18));
    // First page leaves room for the main chart and its interpretation.
    output.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754"><rect width="100%" height="100%" fill="white"/><g font-family="Arial" fill="#203b43"><text x="60" y="65" font-size="27" font-weight="bold">EVOLUCIÓN DE LA CARGA Y CIERRES</text><text x="60" y="105" font-size="19">${esc(plan.title.slice(0, 95))}</text><text x="60" y="140" font-size="17">Base: ${esc(plan.cutDate)} · Evaluación: ${esc(evolution.latest.date)} · C1 ${n(plan.summary.C1)} / C2 ${n(plan.summary.C2)} / C3 ${n(plan.summary.C3)} / C4 ${n(plan.summary.C4)}</text>${first ? `<svg x="60" y="200" width="1120" height="500" viewBox="0 0 1120 500">${evolution.svg.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg><text x="60" y="760" font-size="22" font-weight="bold">Carga inicial ${n(plan.baseCount)} → carga actualizada ${n(evolution.workload)}</text><text x="60" y="800" font-size="22">${n(evolution.latest.closed)} cierres XML · ${n(evolution.latest.pending)} pendientes al corte</text><text x="60" y="845" font-size="17">Base + entradas - otras salidas - cierres = pendiente actual.</text><text x="60" y="880" font-size="16">${evolution.replan ? `Morado: metas editadas desde ${evolution.replan.anchorDate}; sin suponer nuevas entradas futuras.` : "Naranja: referencia de carga, no es una reprogramación ni garantiza la fecha final."}</text><text x="60" y="910" font-size="16">${esc(progressNote)}</text>` : ""}<g font-size="17">${header.map((label, i) => `<text x="${x[i]}" y="${tableY}">${label}</text>`).join("")}${pageRows.map((row, index) => [row.date, n(plan.baseCount), n(row.closed), n(row.entries), n(row.exits), n(row.pending)].map((value, i) => `<text x="${x[i]}" y="${tableY + 42 + index * 38}">${esc(value)}</text>`).join("")).join("")}</g><text x="60" y="1700" font-size="15">La base original se conserva. Las otras salidas no acreditan resolución física.</text></g></svg>`,
    );
    offset += pageRows.length;
  }
  if (evolution.replan) {
    const version = evolution.replan;
    const future = weeklyReplanSchedule(version);
    for (let offset = 0; offset < future.length; offset += 24) {
      const columns = [60, 285, 520, 770, 1020];
      const labels = ["Control", "Meta período", "Objetivo acumulado", "Real manual", "Desviación"];
      output.push(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754"><rect width="100%" height="100%" fill="white"/><g font-family="Arial" fill="#203b43"><text x="60" y="65" font-size="27" font-weight="bold">METAS FUTURAS DESDE EL CORTE</text><text x="60" y="110" font-size="18">${esc(version.anchorDate)}: ${n(version.anchorClosed)} cierres acumulados + ${n(version.pending)} pendientes.</text><text x="60" y="145" font-size="17">Objetivo: ${n(version.anchorClosed + version.pending)} cierres acumulados al ${esc(version.endDate)}.</text><g font-size="17">${labels.map((label, i) => `<text x="${columns[i]}" y="220">${label}</text>`).join("")}${future
          .slice(offset, offset + 24)
          .map((row, index) =>
            [
              row.date,
              n(row.weekly),
              n(row.target),
              row.actual === null ? "Sin registro" : n(row.actual),
              row.deviation === null ? "—" : n(row.deviation),
            ]
              .map(
                (value, i) =>
                  `<text x="${columns[i]}" y="${265 + index * 43}">${esc(value)}</text>`,
              )
              .join(""),
          )
          .join(
            "",
          )}</g><text x="60" y="1530" font-size="17">Las metas son compromisos futuros; no se acreditan como cierres realizados.</text><text x="60" y="1565" font-size="17">${esc(weeklyReplanErrors(version).join(" ").slice(0, 125) || "Todas las interferencias pendientes tienen una meta asignada.")}</text><text x="60" y="1700" font-size="15">Historial XML conservado; avances futuros manuales guardados por versión.</text></g></svg>`,
      );
    }
  }
  return output;
}
