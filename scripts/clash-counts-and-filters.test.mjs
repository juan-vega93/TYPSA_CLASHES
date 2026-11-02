import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { rolldown } from "rolldown";

async function loadModule(input) {
  const bundle = await rolldown({
    input,
    platform: "node",
    resolve: { alias: { "@": path.resolve("src") } },
  });
  const { output } = await bundle.generate({ format: "esm" });
  await bundle.close();
  return import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString("base64")}`);
}
const { parseClashXml } = await loadModule("src/lib/clash-parser.ts");
const { buildClashIndex, queryClashes, summarizeClashes, MISSING_LEVEL } =
  await loadModule("src/lib/clash-query.ts");
const { DEFAULT_PROJECT_CONFIG } = await loadModule("src/lib/project-config.ts");
const fixture = `<exchange><batchtest><clashtests><clashtest name="T"><clashresults>
<clashgroup guid="group" name="Group" status="new"><clashresults><clashresult guid="child" status="new" /></clashresults></clashgroup>
<clashresult guid="resolved" status="resolved" /><clashresult guid="reviewed" status="reviewed" />
</clashresults></clashtest></clashtests></batchtest></exchange>`;
const fixtureRows = parseClashXml(fixture, "fixture");
assert.equal(fixtureRows.length, 3);
assert.ok(fixtureRows.some((clash) => clash.id === "group" && clash.kind === "group"));
assert.ok(!fixtureRows.some((clash) => clash.id === "child"));
assert.equal(summarizeClashes(fixtureRows).pending, 2);
assert.equal(summarizeClashes(fixtureRows).resolved, 1);

const item = (nivel) => ({ nivel });
const row = (id, a, b, test = "T", status = "active") => ({
  ...fixtureRows[0],
  id,
  kind: "clash",
  test,
  status,
  nivel: a ?? b,
  filterValues: { nivel: a ?? b },
  items: [item(a), item(b)],
});
const rows = [
  row("1", "N01", "N02"),
  row("2", "N02", "N02"),
  row("3", "N03", "N04", "OTHER"),
  row("4", undefined, "N02"),
  row("5", undefined, undefined),
];
const index = buildClashIndex(rows, DEFAULT_PROJECT_CONFIG);
const ids = (filters) =>
  queryClashes(index, filters)
    .map((clash) => clash.id)
    .sort();
assert.deepEqual(ids({ nivel: ["N01", "N02"] }), ["1", "2", "4"]);
assert.deepEqual(ids({ nivel: ["N02"], nivelSource: "a" }), ["2"]);
assert.deepEqual(ids({ nivel: ["N02"], nivelSource: "b" }), ["1", "2", "4"]);
assert.deepEqual(ids({ nivel: ["N02"], nivelSource: "primary" }), ["2", "4"]);
assert.deepEqual(ids({ nivel: ["N02", "N03"], test: "OTHER" }), ["3"]);
assert.deepEqual(ids({ nivel: [] }), []);
assert.deepEqual(ids({ nivelSource: "b" }), ["1", "2", "3", "4", "5"]);
assert.deepEqual(ids({ nivel: index.levelOptions.either }), ["1", "2", "3", "4", "5"]);
assert.deepEqual(ids({ nivel: [MISSING_LEVEL] }), ["5"]);
assert.deepEqual(ids({ nivel: [MISSING_LEVEL], nivelSource: "a" }), ["4", "5"]);
assert.deepEqual(ids({ nivel: ["N01", "N02"], search: "OTHER" }), []);
assert.equal(new Set(ids({ nivel: ["N01", "N02"] })).size, 3);

if (process.argv[2]) {
  let fileCount = 0,
    total = 0,
    groups = 0;
  for (const file of await fs.readdir(process.argv[2])) {
    if (!file.endsWith(".xml")) continue;
    const xml = await fs.readFile(path.join(process.argv[2], file), "utf8");
    const parsed = parseClashXml(xml, file);
    const actualIndex = buildClashIndex(parsed, DEFAULT_PROJECT_CONFIG);
    assert.equal(
      queryClashes(actualIndex, { nivel: actualIndex.levelOptions.either }).length,
      parsed.length,
      `${file}: selecting all levels must preserve the full report`,
    );
    for (const match of xml.matchAll(
      /<clashtest\b[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/clashtest>/g,
    )) {
      const summary = match[2].match(/<summary\b([^>]*)>/);
      if (!summary) continue;
      const expected = Object.fromEntries(
        [...summary[1].matchAll(/(\w+)="(\d+)"/g)].map((m) => [m[1], Number(m[2])]),
      );
      const testRows = parsed.filter((clash) => clash.test === match[1]);
      const metrics = summarizeClashes(testRows);
      assert.equal(metrics.total, expected.total, `${file}: total`);
      assert.equal(
        metrics.pending,
        (expected.new ?? 0) + (expected.active ?? 0) + (expected.reviewed ?? 0),
        `${file}: pending`,
      );
      assert.equal(
        metrics.resolved,
        (expected.resolved ?? 0) + (expected.approved ?? 0),
        `${file}: closed`,
      );
      if (file === "P1_EST-ACI.xml") {
        console.log("EST-ACI:", {
          total: metrics.total,
          pending: metrics.pending,
          resolved: metrics.resolved,
          groups: testRows.filter((clash) => clash.kind === "group").length,
        });
      }
    }
    fileCount++;
    total += parsed.length;
    groups += parsed.filter((clash) => clash.kind === "group").length;
  }
  console.log("All XML summaries matched", { files: fileCount, total, groups });
}
console.log(
  "Counts, grouped results, multi-level OR, A/B/either, empty/all selection and other filters: passed",
);
