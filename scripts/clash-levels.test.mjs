import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { rolldown } from "rolldown";
import { normalizeLevel } from "../src/lib/clash-levels.ts";

for (const [input, expected] of [
  [undefined, undefined],
  ["", undefined],
  ["   ", undefined],
  ["<Sin nivel>", undefined],
  ["<No level>", undefined],
  ['Level "", #123', undefined],
  ['Level "NS2", #10970075', "NS2"],
  ['Level "NS2", #295179', "NS2"],
  ['Nivel "N04", #123', "N04"],
  ['Level "Plano general de equipamiento N01 - ESC 50", #10530514', "N01"],
  ['Level "Plano general de equipamiento N01 - ESC 501", #10530514', "N01"],
  ['Level "PLANTA_N12", #13472663', "N12"],
  ['Level "NS2 - CIMENTACIÓN", #10330865', "NS2"],
  ["N00", "N00"],
  [" n1 ", "N01"],
  ["NS02", "NS2"],
  ["AS2", "AS2"],
  ['Level "NIV-+0.00", #35394', "NIV-+0.00"],
  ['Level "Cubierta técnica", #44', "Cubierta técnica"],
  ["N01 / N02", "N01 / N02"],
  ["N01-N01", "N01"],
  ["XN01A", "XN01A"],
])
  assert.equal(normalizeLevel(input), expected, String(input));

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
const { buildClashIndex, queryClashes } = await loadModule("src/lib/clash-query.ts");
const { DEFAULT_PROJECT_CONFIG } = await loadModule("src/lib/project-config.ts");
const object = (value, layer = "", tag = "Componente Nivel") =>
  `<clashobject><layer>${layer}</layer><smarttags><smarttag><name>${tag}</name><value>${value.replaceAll('"', "&quot;")}</value></smarttag></smarttags></clashobject>`;
const fixture = (objects) =>
  `<exchange><batchtest><clashtests><clashtest name="Levels"><clashresults><clashresult guid="1" status="new"><clashobjects>${objects}</clashobjects></clashresult></clashresults></clashtest></clashtests></batchtest></exchange>`;
const raw = 'Level "N01", #123';
const rows = parseClashXml(fixture(object(raw) + object("N02")), "fixture");
assert.equal(rows[0].nivel, "N01");
assert.equal(rows[0].filterValues.nivel, "N01");
assert.equal(rows[0].items[0].raw["Componente Nivel"], raw);
assert.equal(rows[0].items[1].nivel, "N02");
const fallback = parseClashXml(
  fixture(object("", "NS1") + object('Level "N03", #9')),
  "fixture",
)[0];
assert.equal(fallback.items[0].nivel, undefined);
assert.equal(fallback.nivel, "N03");
assert.equal(fallback.filterValues.nivel, "N03");
assert.equal(
  parseClashXml(fixture(object('Level "", #123', "NS2")), "fixture")[0].nivel,
  undefined,
);
assert.equal(parseClashXml(fixture(object(raw, "", "Element Level")), "fixture")[0].nivel, "N01");
const missingLayer = parseClashXml(
  fixture(object("", "&lt;Sin nivel&gt;") + object("N04")),
  "fixture",
)[0];
assert.equal(missingLayer.nivel, "N04");
assert.equal(missingLayer.filterValues.nivel, "N04");
const index = buildClashIndex(rows, DEFAULT_PROJECT_CONFIG);
assert.deepEqual(index.options.nivel, ["N01"]);
assert.equal(queryClashes(index, { nivel: "N01" }).length, 1);
assert.equal(queryClashes(index, { nivel: "N02" }).length, 1);
assert.equal(queryClashes(index, { nivel: "N02", nivelSource: "primary" }).length, 0);
// Indexing legacy callers with unnormalized filter values must also converge.
assert.deepEqual(
  buildClashIndex([{ ...rows[0], filterValues: { nivel: raw } }], DEFAULT_PROJECT_CONFIG).options
    .nivel,
  ["N01"],
);

if (process.argv[2]) {
  const all = [];
  const originals = new Set();
  for (const file of await fs.readdir(process.argv[2])) {
    if (!file.endsWith(".xml")) continue;
    const xml = await fs.readFile(path.join(process.argv[2], file), "utf8");
    const parsed = parseClashXml(xml, file);
    assert.equal(parsed.length, [...xml.matchAll(/<(?:clashresult|clashgroup)\b/g)].length, file);
    for (const clash of parsed) {
      assert.equal(clash.nivel, clash.filterValues.nivel, `${file}: level/filter mismatch`);
      for (const item of clash.items) {
        const value = item.raw?.["Componente Nivel"] || item.raw?.["Element Nivel"];
        if (value) originals.add(value);
        if (item.nivel) assert.ok(!/^(?:Level|Nivel)\s+"/.test(item.nivel), item.nivel);
      }
    }
    all.push(...parsed);
  }
  const actual = buildClashIndex(all, DEFAULT_PROJECT_CONFIG);
  const covered = actual.options.nivel.reduce(
    (sum, nivel) => sum + queryClashes(actual, { nivel, nivelSource: "primary" }).length,
    0,
  );
  assert.equal(covered, all.filter((clash) => clash.nivel).length);
  console.log(
    JSON.stringify({
      clashes: all.length,
      originalPropertyLabels: originals.size,
      levels: actual.options.nivel,
      covered,
    }),
  );
}
console.log(
  "Levels: canonical labels, raw values, no inference from layers, EN/ES and filter consistency passed",
);
