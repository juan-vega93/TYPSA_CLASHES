import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
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
const { snapshotFromPath, discoverSnapshotFolders, foldersInRange } = await mod(
  "src/lib/snapshot-folders.ts",
);
for (const ignored of [
  "../data/backup/a.xml",
  "../data/261023/extra/a.xml",
  "../data/backup/261023/a.xml",
  "../data/a.xml",
  "../data/20261023/a.xml",
  "../data/260231/a.xml",
  "../data/261332/a.xml",
])
  assert.equal(snapshotFromPath(ignored), undefined, ignored);
assert.equal(snapshotFromPath("../data/240229/a.xml").date, "2024-02-29");
assert.equal(snapshotFromPath("../data/260229/a.xml"), undefined);
const manifest = discoverSnapshotFolders([
  "../data/261023/a.xml",
  "../data/260707/a.xml",
  "../data/261019/a.xml",
  "../data/backup/a.xml",
  "../data/261023/b.xml",
]);
assert.deepEqual(
  manifest.map((c) => c.key),
  ["260707", "261019", "261023"],
);
assert.deepEqual(
  foldersInRange(manifest, { start: "2026-10-19", end: "2026-10-23" }).map((c) => c.key),
  ["261019", "261023"],
);
assert.deepEqual(foldersInRange(manifest, undefined), []);
assert.deepEqual(foldersInRange(manifest, { start: "2026-10-23", end: "2026-10-19" }), []);
const { compactClash } = await mod("src/lib/compact-clash.ts");
const { parseClashXml } = await mod("src/lib/clash-parser.ts");
const { buildClashIndex, queryClashes, compileClashFilter, MISSING_LEVEL } =
  await mod("src/lib/clash-query.ts");
const { DEFAULT_PROJECT_CONFIG } = await mod("src/lib/project-config.ts");
const { createCoordinationClassifier, DEFAULT_COORDINATION_RULES } = await mod(
  "src/lib/coordination-priority.ts",
);
const { reconcileSnapshots } = await mod("src/lib/commitment-control.ts");
const xml =
  '<exchange><batchtest><clashtests><clashtest name="P1_EST-ACI" test_type="hard"><clashresults><clashresult guid="fixture" name="Conflicto" status="active"><clashobjects><clashobject><smarttags><smarttag><name>Componente Categoría</name><value>Muros</value></smarttag><smarttag><name>Componente Nivel</name><value>N00</value></smarttag><smarttag><name>Componente Familia</name><value>Muro básico</value></smarttag></smarttags></clashobject><clashobject><smarttags><smarttag><name>Componente Categoría</name><value>Tuberías</value></smarttag><smarttag><name>Componente Nivel</name><value>N01</value></smarttag></smarttags></clashobject></clashobjects></clashresult></clashresults></clashtest></clashtests></batchtest></exchange>';
const original = parseClashXml(xml, "fixture");
const rows = [
  ...original,
  { ...original[0], id: "missing", nivel: undefined, filterValues: {}, items: [{}, {}] },
  {
    ...original[0],
    id: "b",
    status: "resolved",
    test: "P2_EST-IEL",
    nivel: "N02",
    filterValues: { nivel: "N02", zona: "Zona B" },
    zona: "Zona B",
    items: [{ category: "Armazón estructural", nivel: "N02" }, { category: "Conductos" }],
  },
];
const compact = rows.map(compactClash);
assert.equal(compact[0].items[0].raw, undefined);
assert.equal(original[0].items[0].raw["Componente Categoría"], "Muros");
for (const filters of [
  {},
  { test: ["P1_EST-ACI"] },
  { status: ["resolved"] },
  { nivel: ["N00", "N02"] },
  { nivel: [MISSING_LEVEL] },
  { nivel: ["N01"], nivelSource: "b" },
  { nivel: ["N01"], nivelSource: "primary" },
  { nivel: [] },
  { zona: ["Zona B"] },
  { search: "muro básico" },
  { test: ["P1_EST-ACI"], nivel: ["N00"], search: "conflicto" },
]) {
  const expected = queryClashes(buildClashIndex(rows, DEFAULT_PROJECT_CONFIG), filters).map(
    (r) => r.id,
  );
  assert.deepEqual(
    rows
      .filter(compileClashFilter(DEFAULT_PROJECT_CONFIG, filters))
      .map((r) => r.id)
      .sort(),
    expected.sort(),
  );
  assert.deepEqual(
    compact
      .filter(compileClashFilter(DEFAULT_PROJECT_CONFIG, filters))
      .map((r) => r.id)
      .sort(),
    expected.sort(),
  );
}
const classifier = createCoordinationClassifier(DEFAULT_COORDINATION_RULES);
assert.deepEqual(compact.map(classifier), rows.map(classifier));
const snapshots = [
  { key: "a", date: "2026-10-19", label: "a", clashes: rows },
  {
    key: "b",
    date: "2026-10-23",
    label: "b",
    clashes: rows.map((r) => ({ ...r, status: "resolved" })),
  },
];
const detailed = reconcileSnapshots(snapshots);
const summary = reconcileSnapshots(snapshots, () => true, { details: false });
assert.ok(detailed[1].events.length);
assert.deepEqual(
  summary.map((c) => ({ ...c, events: [] })),
  detailed.map((c) => ({ ...c, events: [] })),
);
assert.ok(summary.every((c) => c.events.length === 0));
let response;
globalThis.self = {
  postMessage: (value) => {
    response = value;
  },
};
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url) => ({
  ok: url === "/fixture.xml",
  status: url === "/fixture.xml" ? 200 : 404,
  text: async () => xml,
});
await mod("src/lib/clash-worker.ts");
await globalThis.self.onmessage({
  data: {
    id: 1,
    files: [{ name: "test", url: "/fixture.xml" }],
    compact: true,
    config: DEFAULT_PROJECT_CONFIG,
  },
});
assert.equal(response.clashes.length, 1);
assert.equal(response.clashes[0].items[0].raw, undefined);
await globalThis.self.onmessage({
  data: {
    id: 2,
    files: [{ name: "test", url: "/missing.xml" }],
    compact: true,
    config: DEFAULT_PROJECT_CONFIG,
  },
});
assert.equal(response.errors.length, 1);
globalThis.fetch = nativeFetch;
if (process.argv.includes("--data")) {
  const folders = (await fs.readdir("src/data")).filter((f) =>
    snapshotFromPath(`../data/${f}/x.xml`),
  );
  let fullBytes = 0,
    compactBytes = 0,
    total = 0;
  const history = [];
  let oldMs = 0,
    newMs = 0;
  for (const folder of folders.sort()) {
    const compactRows = [];
    for (const file of await fs.readdir(`src/data/${folder}`)) {
      if (!file.endsWith(".xml")) continue;
      const parsed = parseClashXml(await fs.readFile(`src/data/${folder}/${file}`, "utf8"), file);
      const slim = parsed.map(compactClash);
      total += parsed.length;
      const startOld = performance.now();
      const index = buildClashIndex(parsed, DEFAULT_PROJECT_CONFIG);
      const expected = queryClashes(index, { status: ["active", "reviewed"] }).length;
      oldMs += performance.now() - startOld;
      const startNew = performance.now();
      assert.equal(
        slim.filter(compileClashFilter(DEFAULT_PROJECT_CONFIG, { status: ["active", "reviewed"] }))
          .length,
        expected,
      );
      newMs += performance.now() - startNew;
      for (let i = 0; i < parsed.length; i++) {
        fullBytes += Buffer.byteLength(JSON.stringify(parsed[i]));
        compactBytes += Buffer.byteLength(JSON.stringify(slim[i]));
        assert.equal(classifier(slim[i]), classifier(parsed[i]));
      }
      compactRows.push(...slim);
    }
    const date = snapshotFromPath(`../data/${folder}/x.xml`).date;
    history.push({ key: folder, date, label: folder, clashes: compactRows });
  }
  const aggregate = reconcileSnapshots(history, () => true, { details: false });
  assert.ok(aggregate.every((c) => !c.events.length));
  console.log("Real data:", {
    cuts: history.length,
    rows: total,
    fullMB: (fullBytes / 1e6).toFixed(1),
    compactMB: (compactBytes / 1e6).toFixed(1),
    reductionPercent: (100 - (compactBytes / fullBytes) * 100).toFixed(1),
    oldIndexAndFilterMs: Math.round(oldMs),
    directFilterMs: Math.round(newMs),
    balances: aggregate.map((c) => ({ date: c.date, pending: c.pending, delta: c.delta })),
  });
}
console.log(
  "History performance: strict dated folders, range selection, compact fidelity, filter parity, aggregate-only reconciliation and worker URL loading passed",
);
