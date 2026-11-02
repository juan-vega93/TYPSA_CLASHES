import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { rolldown } from "rolldown";
async function mod(input) {
  const bundle = await rolldown({
    input,
    platform: "node",
    resolve: { alias: { "@": path.resolve("src") } },
  });
  const { output } = await bundle.generate({ format: "esm" });
  await bundle.close();
  return import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString("base64")}`);
}
const { reconcileSnapshots, clashIdentity, baselineMembership, forecastPoints, validForecasts } =
  await mod("src/lib/commitment-control.ts");
const { createCoordinationPlan, validCoordinationPlan } = await mod("src/lib/coordination-plan.ts");
const { DEFAULT_COORDINATION_RULES } = await mod("src/lib/coordination-priority.ts");
const { commitmentGraphs, controlCsv, eventCsv, controlPdf, periodSummarySvg, controlReportPages } =
  await mod("src/lib/commitment-export.ts");
const { buildClashIndex, queryClashes } = await mod("src/lib/clash-query.ts");
const { DEFAULT_PROJECT_CONFIG } = await mod("src/lib/project-config.ts");
const row = (id, status = "active", test = "A", selected = true) => ({
  id,
  name: id,
  test,
  status,
  selected,
  testType: "hard",
  items: [{ category: "Pilares estructurales" }, { category: "Tuberías" }],
});
const cut = (key, date, clashes) => ({ key, date, label: key, clashes });
const snapshots = [
  cut("base", "2026-10-19", [
    row("a"),
    row("b", "resolved"),
    row("c"),
    row("d"),
    row("f"),
    row("g", "active", "A", false),
    row("a", "active", "B"),
  ]),
  cut("week1", "2026-10-26", [
    row("a", "resolved"),
    row("b"),
    row("d"),
    row("f", "active", "A", false),
    row("g"),
    row("j"),
    row("a", "active", "C"),
    row("unseen-closed", "resolved"),
  ]),
  cut("week2", "2026-11-02", [
    row("a", "resolved"),
    row("b", "resolved"),
    row("c"),
    row("d"),
    row("f", "active", "A", false),
    row("g"),
    row("a", "active", "B"),
  ]),
];
const balances = reconcileSnapshots(snapshots, (r) => r.selected);
const collisionIndex = buildClashIndex(snapshots[0].clashes, DEFAULT_PROJECT_CONFIG);
assert.equal(
  queryClashes(collisionIndex, { test: "A" }).filter((row) => row.id === "a")[0].test,
  "A",
);
assert.equal(
  queryClashes(collisionIndex, { test: "B" }).filter((row) => row.id === "a")[0].test,
  "B",
);
assert.equal(balances[0].pending, 5);
assert.deepEqual(balances[1].counts, {
  new: 1,
  reopened: 1,
  returned: 0,
  closed: 1,
  missing: 1,
  coverageIn: 1,
  coverageOut: 1,
  scopeIn: 1,
  scopeOut: 1,
});
assert.equal(balances[1].pending, 5);
assert.equal(balances[1].fromDate, "2026-10-19");
assert.equal(balances[1].delta, 0);
assert.equal(balances[2].counts.returned, 1);
assert.equal(balances[2].counts.closed, 1);
assert.equal(balances[2].counts.missing, 1);
for (const balance of balances)
  assert.equal(
    balance.opening + balance.events.reduce((sum, e) => sum + e.delta, 0),
    balance.pending,
  );
assert.equal(balances[1].events.find((e) => e.kind === "coverageIn").test, "C");
assert.ok(!balances[1].events.some((e) => e.kind === "closed" && e.id === "c"));
const reopenedAfterGap = reconcileSnapshots([
  cut("1", "2026-10-01", [row("x", "resolved"), row("z")]),
  cut("2", "2026-10-08", [row("z")]),
  cut("3", "2026-10-15", [row("x"), row("z")]),
]);
assert.equal(reopenedAfterGap[2].counts.reopened, 1);
const legacy = baselineMembership(["a"], undefined, snapshots[0], snapshots[1]);
assert.equal(legacy.unmatched, 1);
const keys = [clashIdentity(row("a")), clashIdentity(row("c"))];
const membership = baselineMembership(["a", "c"], keys, snapshots[0], snapshots[1]);
assert.equal(membership.closed, 1);
assert.equal(membership.missing, 1);
const plan = createCoordinationPlan(
  [row("a"), row("a", "active", "B"), row("c"), row("d"), row("f")],
  "Verificación: compromiso inicial",
  "2026-10-19",
  DEFAULT_COORDINATION_RULES,
  "{}",
  "2026-10-19",
  "2026-12-31",
  "s",
);
assert.equal(plan.baseCount, 5);
assert.ok(validCoordinationPlan(plan));
assert.equal(new Set(plan.baseKeys).size, 5);
const dates = Object.keys(plan.goals);
plan.actuals[dates[0]] = 0;
plan.actuals[dates[1]] = 1;
plan.actuals[dates[2]] = 2;
const version = {
  id: "v1",
  createdAt: "2026-10-28T14:00:00Z",
  planId: plan.id,
  cutKey: "week2",
  cutDate: "2026-11-02",
  pending: 3000,
  closuresPerWeek: 2000,
  arrivalsPerWeek: 500,
  scope: "C1 + C2",
};
assert.ok(validForecasts([version]));
assert.ok(!validForecasts([version, version]));
assert.ok(!validForecasts([{ ...version, cutDate: "2026-02-30" }]));
assert.equal(forecastPoints(version).weeks, 2);
assert.equal(forecastPoints(version).completion, "2026-11-16");
const divergent = { ...version, closuresPerWeek: 300, arrivalsPerWeek: 500 };
assert.equal(forecastPoints(divergent).completion, null);
assert.ok(forecastPoints(divergent).points[1].value > 3000);
assert.equal(
  forecastPoints({ ...version, pending: 0, closuresPerWeek: 0, arrivalsPerWeek: 0 }).weeks,
  0,
);
assert.ok(validForecasts([{ ...version, closuresPerWeek: 0 }]));
const report = {
  title: "Verificación de exportación",
  plan,
  cuts: balances.slice(0, 2),
  selected: balances[1],
  scope: "C1 + C2 · 3 tests · prueba de conciliación",
  forecast: {
    ...version,
    cutKey: "week1",
    cutDate: "2026-10-26",
    pending: 5,
    closuresPerWeek: 2,
    arrivalsPerWeek: 1,
  },
  notes: [
    "Prueba de conciliación. Cada resultado se identifica por test + GUID.",
    "Los resultados ausentes se mantienen separados de los cierres confirmados.",
  ],
  membership,
  scopeDetails: JSON.stringify({
    tests: ["A", "B", "C"],
    classes: ["C1", "C2"],
    rules: DEFAULT_COORDINATION_RULES,
  }),
};
const graphs = commitmentGraphs(report);
const screenshotCut = {
  ...balances[1],
  opening: 14641,
  pending: 17156,
  delta: 2515,
  counts: {
    ...balances[1].counts,
    new: 4601,
    reopened: 0,
    returned: 0,
    closed: 4335,
    missing: 0,
    coverageIn: 3092,
    coverageOut: 843,
    scopeIn: 0,
    scopeOut: 0,
  },
};
const summarySvg = periodSummarySvg(screenshotCut);
const firstReportPage = controlReportPages({ ...report, selected: screenshotCut })[0];
assert.ok(firstReportPage.includes("BALANCE DEL PERÍODO"));
assert.ok(firstReportPage.includes("Quedan por cerrar"));
assert.ok(
  firstReportPage.indexOf("BALANCE DEL PERÍODO") < firstReportPage.indexOf("LECTURA EJECUTIVA"),
);
assert.ok(!summarySvg.includes("56.3%"));
assert.ok(summarySvg.includes("El pendiente aumentó"));
assert.ok(summarySvg.includes("+2,515"));
const compensatedSvg = periodSummarySvg({
  ...screenshotCut,
  pending: 13491,
  delta: -1150,
  counts: { ...screenshotCut.counts, closed: 8000 },
});
assert.ok(compensatedSvg.includes("El pendiente disminuyó"));
const prioritiesSummary = periodSummarySvg({
  ...screenshotCut,
  opening: 4581,
  pending: 4838,
  delta: 257,
  counts: { ...screenshotCut.counts, new: 2058, closed: 1801, coverageIn: 0, coverageOut: 0 },
});
assert.ok(!prioritiesSummary.includes("87.5%"));
assert.ok(prioritiesSummary.includes("27.1%"));
assert.ok(prioritiesSummary.includes("El pendiente aumentó"));
assert.ok(summarySvg.includes("19.4%"));
assert.ok(summarySvg.includes("76.8%"));
assert.ok(summarySvg.includes("+17.2%"));
assert.ok(!periodSummarySvg(balances[0]).includes("NaN"));
assert.equal(controlReportPages({ ...report, includeAppendix: false }).length, 2);
assert.ok(
  controlReportPages({ ...report, includeAppendix: false })[0].includes(
    "¿Cómo queda la carga del período?",
  ),
);
assert.ok(graphs.commitment.includes("Avance real manual"));
assert.equal(
  (graphs.commitment.match(/fill="#c46c32"/g) ?? []).length,
  2,
  "Only manual actuals up to the evaluation cut belong in the report",
);
assert.ok(
  !commitmentGraphs({ ...report, compareInventoryPlan: false }).inventory.includes(
    "Pendiente planeado original",
  ),
);
assert.ok(graphs.balance.includes("No localizados"));
assert.ok(controlCsv(report).includes("Cobertura incorporada"));
assert.ok(eventCsv(balances[1]).includes("Reabiertos"));
await assert.rejects(
  () => controlPdf({ ...report, plan: { ...plan, actuals: { [dates[1]]: 999 } } }),
  /Corrige/,
);
if (process.argv.includes("--pdf")) {
  const { createCanvas, loadImage } =
    await import("file:///C:/Users/jjvega/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js");
  await fs.mkdir("tmp/pdfs", { recursive: true });
  const visualPlan = createCoordinationPlan(
    Array.from({ length: 14641 }, (_, i) => row(`visual-${i}`)),
    "Verificación del reporte ejecutivo",
    snapshots[0].date,
    DEFAULT_COORDINATION_RULES,
    "{}",
    snapshots[0].date,
    "2026-12-31",
    "s",
  );
  visualPlan.actuals[Object.keys(visualPlan.goals)[0]] = 0;
  visualPlan.actuals[Object.keys(visualPlan.goals)[1]] = 4335;
  await fs.writeFile(
    "tmp/pdfs/control-verification.pdf",
    await controlPdf(
      {
        ...report,
        plan: visualPlan,
        cuts: [{ ...balances[0], opening: 14641, pending: 14641, total: 14641 }, screenshotCut],
        forecast: {
          ...report.forecast,
          pending: 17156,
          closuresPerWeek: 3000,
          arrivalsPerWeek: 1000,
        },
        includeAppendix: false,
        selected: {
          ...screenshotCut,
          date: report.selected.date,
          fromDate: report.selected.fromDate,
        },
      },
      { createCanvas, loadSvg: (svg) => loadImage(Buffer.from(svg)) },
    ),
  );
}
if (process.argv.includes("--data")) {
  const { parseClashXml } = await mod("src/lib/clash-parser.ts");
  const folders = (await fs.readdir("src/data")).filter((f) => /^\d{6,8}$/.test(f)).sort();
  const source = [];
  for (const folder of folders) {
    const clashes = [];
    for (const file of await fs.readdir(`src/data/${folder}`)) {
      if (file.endsWith(".xml"))
        clashes.push(
          ...parseClashXml(await fs.readFile(`src/data/${folder}/${file}`, "utf8"), file),
        );
    }
    const full = folder.length === 6 ? "20" + folder : folder;
    source.push(
      cut(folder, `${full.slice(0, 4)}-${full.slice(4, 6)}-${full.slice(6, 8)}`, clashes),
    );
  }
  const history = reconcileSnapshots(source);
  for (const r of history)
    assert.equal(r.opening + r.events.reduce((sum, e) => sum + e.delta, 0), r.pending);
  console.log(
    "Historical XML balances:",
    history.map((c) => ({
      date: c.date,
      total: c.total,
      pending: c.pending,
      closedTransitions: c.counts.closed,
      missing: c.counts.missing,
      coverageIn: c.counts.coverageIn,
      coverageOut: c.counts.coverageOut,
      duplicates: c.duplicates,
    })),
  );
}
const { commitmentBreakdown, testSpecialties, breakdownSvg } = await mod(
  "src/lib/commitment-breakdown.ts",
);
const { planEvolution, evolutionReportPages } = await mod("src/lib/plan-evolution.ts");
const originalRows = Array.from({ length: 14 }, (_, i) => row(`original-${i}`));
const evolvedRows = [
  ...originalRows.map((r, i) => (i < 5 ? { ...r, status: "resolved" } : r)),
  ...Array.from({ length: 6 }, (_, i) => row(`new-${i}`)),
];
const evolutionPlan = createCoordinationPlan(
  originalRows,
  "Base 19",
  "2026-10-19",
  DEFAULT_COORDINATION_RULES,
  JSON.stringify({ source: "cut" }),
  "2026-10-19",
  "2026-12-31",
  "s",
);
const evolutionCuts = [cut("19", "2026-10-19", originalRows), cut("23", "2026-10-23", evolvedRows)];
const evolutionResult = planEvolution(evolutionPlan, evolutionCuts, DEFAULT_PROJECT_CONFIG);
assert.deepEqual(evolutionResult.rows.at(-1), {
  date: "2026-10-23",
  closed: 5,
  entries: 6,
  exits: 0,
  pending: 15,
});
assert.ok(evolutionResult.svg.includes("Plan original acumulado"));
assert.ok(evolutionResult.svg.includes("Referencia ajustada"));
assert.ok(evolutionResult.svg.includes("Cierres realizados"));
assert.equal(evolutionResult.workload, 20);
assert.equal(
  evolutionResult.workload - evolutionResult.latest.closed,
  evolutionResult.latest.pending,
);
const evolutionPages = evolutionReportPages(evolutionPlan, evolutionResult);
const manualDates = Object.keys(evolutionPlan.goals).sort();
const manualPlan = { ...evolutionPlan, actuals: { [manualDates[0]]: 0, [manualDates[1]]: 3 } };
const manualEvolution = planEvolution(
  manualPlan,
  evolutionCuts,
  DEFAULT_PROJECT_CONFIG,
  "manual",
  evolutionResult.rows,
);
assert.equal(
  manualEvolution.rows,
  evolutionResult.rows,
  "Drawing manual progress reuses the historical balance",
);
assert.deepEqual(manualEvolution.manualPoints, [
  { date: manualDates[0], value: 0 },
  { date: manualDates[1], value: 3 },
]);
assert.ok(manualEvolution.svg.includes("Avance real manual de la base"));
assert.ok(!manualEvolution.svg.includes("Cierres realizados acumulados (XML)"));
assert.equal((manualEvolution.svg.match(/fill="#059669"/g) ?? []).length, 2);
const emptyManual = planEvolution(
  evolutionPlan,
  evolutionCuts,
  DEFAULT_PROJECT_CONFIG,
  "manual",
  evolutionResult.rows,
);
assert.ok(emptyManual.svg.includes("sin registros"));
assert.equal((emptyManual.svg.match(/fill="#059669"/g) ?? []).length, 0);
const manualPages = evolutionReportPages(manualPlan, manualEvolution);
assert.ok(manualPages[0].includes(`avance manual 3 al ${manualDates[1]}`));
assert.equal(
  evolutionPlan.actuals[manualDates[1]],
  undefined,
  "Manual entry leaves the original object untouched",
);
assert.equal(evolutionPages.length, 1);
assert.ok(evolutionPages[0].includes("CURVA ORIGINAL, CARGA ADICIONAL Y CIERRES"));
assert.ok(!evolutionPages[0].includes("PLAN DE RESOLUCIÓN · PLANEADO Y AVANCE REAL"));
const manyRows = Array.from({ length: 40 }, (_, i) => ({
  ...evolutionResult.latest,
  date: `cut-${String(i).padStart(2, "0")}`,
}));
const multipage = evolutionReportPages(evolutionPlan, { ...evolutionResult, rows: manyRows });
assert.equal(multipage.length, 3);
for (const row of manyRows)
  assert.equal(multipage.join("").split(`>${row.date}</text>`).length - 1, 1);
if (process.argv.includes("--evolution-pdf")) {
  const { createCanvas, loadImage } =
    await import("file:///C:/Users/jjvega/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js");
  const { svgPagesPdf } = await mod("src/lib/commitment-export.ts");
  await fs.mkdir("tmp/pdfs", { recursive: true });
  await fs.writeFile(
    "tmp/pdfs/evolution-verification.pdf",
    await svgPagesPdf(manualPages, {
      createCanvas,
      loadSvg: (svg) => loadImage(Buffer.from(svg)),
    }),
  );
}
assert.throws(
  () => planEvolution(evolutionPlan, evolutionCuts.slice(1), DEFAULT_PROJECT_CONFIG),
  /Incluye el corte/,
);
assert.throws(
  () =>
    planEvolution(
      { ...evolutionPlan, baseCount: 13, baseKeys: evolutionPlan.baseKeys.slice(1) },
      evolutionCuts,
      DEFAULT_PROJECT_CONFIG,
    ),
  /no coincide/,
);
for (const balance of reconcileSnapshots(snapshots, (row) => row.selected, { details: false })) {
  for (const mode of ["pair", "test"]) {
    const rows = commitmentBreakdown(balance, mode);
    assert.equal(
      rows.reduce((sum, row) => sum + row.pending, 0),
      balance.pending,
    );
    assert.equal(
      rows.reduce((sum, row) => sum + row.opening, 0),
      balance.opening,
    );
    assert.equal(
      rows.reduce((sum, row) => sum + row.closed, 0),
      balance.counts.closed,
    );
    for (const row of rows)
      assert.equal(row.opening + row.entries - row.closed - row.exits, row.pending);
  }
  assert.deepEqual(balance.events, []);
}
assert.deepEqual(testSpecialties("P1_EST-ACI"), ["EST", "ACI"]);
assert.deepEqual(testSpecialties("P2_ACI-EST"), ["EST", "ACI"]);
const specialtyFiltered = reconcileSnapshots(snapshots, (row) => row.selected && row.test === "A", {
  details: false,
});
assert.ok(
  specialtyFiltered.every((balance) => Object.keys(balance.byTest).every((test) => test === "A")),
);
const groupedReport = {
  title: "Agrupado",
  cuts: specialtyFiltered,
  selected: specialtyFiltered.at(-1),
  scope: "Test A",
  notes: [],
  includeAppendix: false,
  breakdown: commitmentBreakdown(specialtyFiltered.at(-1), "test"),
};
const groupedPages = controlReportPages(groupedReport);
assert.equal(groupedPages.length, 3);
assert.ok(groupedPages.at(-1).includes("Entradas y cierres por encuentro"));
assert.ok(
  !breakdownSvg([
    { label: "<script>", opening: 0, pending: 0, entries: 0, closed: 0, exits: 0 },
  ]).includes("<script>"),
);
console.log(
  "Commitment control: namespace identities, every movement, balanced inventory, baseline ambiguity, forecast scenarios and report exports passed",
);
