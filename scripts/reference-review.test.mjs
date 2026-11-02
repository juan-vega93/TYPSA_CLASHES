import assert from "node:assert/strict";
import path from "node:path";
import { rolldown } from "rolldown";
async function moduleFor(input) {
  const bundle = await rolldown({
    input,
    platform: "node",
    resolve: { alias: { "@": path.resolve("src") } },
  });
  const { output } = await bundle.generate({ format: "esm" });
  await bundle.close();
  return import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString("base64")}`);
}
const {
  DEFAULT_COORDINATION_RULES: defaults,
  classifyCoordination,
  summarizeCoordination,
  specialtyOf,
} = await moduleFor("src/lib/coordination-priority.ts");
const { createCoordinationPlan, coordinationSchedule, planErrors, validPlanList } = await moduleFor(
  "src/lib/coordination-plan.ts",
);
const { buildClashIndex, queryClashes } = await moduleFor("src/lib/clash-query.ts");
const { DEFAULT_PROJECT_CONFIG } = await moduleFor("src/lib/project-config.ts");
const rules = structuredClone(defaults);
const row = (id, a, b, test = "P1_EST-ACI") => ({
  id,
  test,
  testType: "hard",
  status: "active",
  name: id,
  file: "fixture",
  severity: "baja",
  distance: 0,
  pos: { x: 0, y: 0, z: 0 },
  items: [
    { category: a, nivel: "N00" },
    { category: b, nivel: "N01" },
  ],
  zona: "Zona A",
  edificio: "Edificio 1",
});
const rows = [
  row("column", "Structural Columns", "Pipes"),
  row("beam", "Armazón estructural", "Tuberías"),
  row("wall", "Muros", "Conductos", "P1_EST-IEL"),
  row("other", "Equipos mecánicos", "Tuberías"),
];
assert.deepEqual(
  rows.map((r) => classifyCoordination(r, rules)),
  ["C1", "C2", "C3", "C4"],
);
assert.equal(classifyCoordination({ ...rows[2], testType: "clearance" }, rules), "C4");
const changed = structuredClone(rules);
changed.priorityCategories.push("Muros");
assert.equal(classifyCoordination(rows[2], changed), "C2");
const summary = summarizeCoordination(rows, rules);
assert.deepEqual(summary.total, { C1: 1, C2: 1, C3: 1, C4: 1, total: 4 });
assert.equal(summary.specialties.length, 2);
for (const [test, expected] of [
  ["P1_EST-ACI", "EST × ACI"],
  ["P2_ACI-EST", "EST × ACI"],
  ["P1_ARQ-ACI", "ACI × ARQ"],
  ["P2_IME-IEL", "IEL × IME"],
  ["P1_ACI-IME", "ACI × IME"],
  ["P3_PSJ-OCI", "OCI × PSJ"],
  [" p1_est-aci ", "EST × ACI"],
  ["Nombre personalizado", "Nombre personalizado"],
])
  assert.equal(specialtyOf({ test }), expected);
const pairSummary = summarizeCoordination(
  [
    ...rows,
    row("reverse", "Muros", "Conductos", "P2_ACI-EST"),
    row("architecture", "Muros", "Conductos", "P1_ARQ-ACI"),
  ],
  rules,
);
assert.equal(pairSummary.total.total, 6);
assert.equal(pairSummary.specialties.length, 3);
assert.equal(pairSummary.specialties.find(([key]) => key === "EST × ACI")[1].total, 4);
assert.equal(
  pairSummary.specialties.reduce((sum, [, group]) => sum + group.total, 0),
  6,
);
const index = buildClashIndex(rows, DEFAULT_PROJECT_CONFIG);
const { executiveSummary, segmentation } = await moduleFor("src/lib/executive-summary.ts");
const executive = executiveSummary(
  [
    ...rows,
    { ...rows[0], id: "closed-column", status: "resolved" },
    { ...rows[1], id: "approved-beam", status: "approved" },
    { ...rows[2], id: "reviewed-wall", status: "reviewed", zona: undefined },
  ],
  rules,
);
assert.equal(executive.total, 7);
assert.equal(executive.pending, 5);
assert.equal(executive.closed, 2);
assert.deepEqual(executive.statuses, { active: 4, reviewed: 1, resolved: 1, approved: 1 });
assert.deepEqual(executive.severity, { alta: 0, media: 0, baja: 5 });
assert.equal(
  Object.values(executive.statuses).reduce((sum, value) => sum + value, 0),
  executive.total,
);
const severityFiltered = executiveSummary(
  [
    { ...rows[0], severity: "alta" },
    { ...rows[1], severity: "media" },
    { ...rows[2], severity: "alta", status: "resolved" },
  ],
  rules,
);
assert.deepEqual(severityFiltered.severity, { alta: 1, media: 1, baja: 0 });
assert.equal(executive.priority, 2);
assert.equal(executive.priorityTotal, 4);
assert.equal(executive.priorityProgress, 50);
assert.equal(executive.classes.C3, 2);
assert.equal(
  Object.values(executive.classes).reduce((a, b) => a + b, 0),
  executive.pending,
);
assert.equal(
  executive.tests.reduce((sum, test) => sum + test.pending, 0),
  executive.pending,
);
assert.equal(executiveSummary([], rules).progress, 0);
assert.deepEqual(segmentation([{ ...rows[0], zona: "—" }], "zona"), {
  covered: 0,
  missing: 1,
  rows: [],
});
assert.equal(segmentation(rows, "zona").covered, 4);
assert.equal(
  queryClashes(index, { nivel: ["N00", "N01"], zona: ["Zona A"], edificio: ["Edificio 1"] }).length,
  4,
);
assert.equal(queryClashes(index, { nivel: [] }).length, 0);
assert.equal(queryClashes(index, { zona: ["Otra"] }).length, 0);
const plan = createCoordinationPlan(
  rows,
  "Verificación de exportación",
  "2026-10-27",
  rules,
  "Selección de prueba",
  "2026-10-27",
  "2026-12-31",
  "s",
);
assert.equal(plan.baseCount, 4);
assert.deepEqual(plan.actuals, {});
assert.ok(coordinationSchedule(plan).every((r) => r.actual === null));
assert.deepEqual(planErrors(plan), []);
rules.priorityCategories.length = 0;
rows.push(row("new", "Muros", "Conductos"));
assert.equal(plan.baseCount, 4);
assert.ok(plan.rules.priorityCategories.length > 0);
let schedule = coordinationSchedule(plan);
plan.actuals[schedule[0].date] = 0;
plan.actuals[schedule[1].date] = 2;
assert.equal(coordinationSchedule(plan)[0].actual, 0);
assert.ok(validPlanList(JSON.parse(JSON.stringify([plan]))));
assert.ok(!validPlanList([plan, plan]));
plan.actuals[schedule[2].date] = 1;
assert.ok(planErrors(plan).length > 0);
delete plan.actuals[schedule[2].date];
plan.goals[schedule[1].date]++;
assert.ok(planErrors(plan).length > 0);
plan.goals[schedule[1].date]--;
assert.deepEqual(planErrors(plan), []);
if (process.argv.includes("--pdf")) {
  const fs = await import("node:fs/promises");
  const { createCanvas, loadImage } =
    await import("file:///C:/Users/jjvega/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js");
  const { planPdf, planGraphSvg } = await moduleFor("src/lib/plan-export.ts");
  await fs.mkdir("tmp/pdfs", { recursive: true });
  const bytes = await planPdf(plan, {
    createCanvas,
    loadSvg: (svg) => loadImage(Buffer.from(svg)),
  });
  await fs.writeFile("tmp/pdfs/verification.pdf", bytes);
  const image = await loadImage(Buffer.from(planGraphSvg(plan)));
  const canvas = createCanvas(1120, 550);
  canvas.getContext("2d").drawImage(image, 0, 0);
  await fs.writeFile("tmp/pdfs/chart.png", canvas.toBuffer("image/png"));
}
console.log(
  "Checkbox filters, configurable priorities, segmentation totals, frozen baseline, manual actuals and backup validation passed",
);
