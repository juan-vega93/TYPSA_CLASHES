import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { rolldown } from "rolldown";
import {
  createNavisworksTagReader,
  navisworksStatus,
  navisworksTag,
} from "../src/lib/navisworks-values.ts";
import { mergeTestUpdates } from "../src/lib/clash-updates.ts";

for (const [label, expected] of Object.entries({
  Nuevo: "active",
  Activo: "active",
  Revisado: "reviewed",
  Aprobado: "approved",
  Resuelto: "resolved",
  Resolved: "resolved",
})) {
  assert.equal(navisworksStatus(undefined, label), expected);
}
assert.equal(navisworksStatus("resolved", "Activo"), "resolved");
assert.equal(navisworksStatus("new", "Resuelto"), "active");
assert.equal(navisworksTag({ "Componente Categoría": "Suelos" }, "Element Category"), "Suelos");
assert.equal(
  navisworksTag({ "Componente Id": "001234567890123456" }, "Element ID elemento"),
  "001234567890123456",
);
assert.equal(navisworksTag({ "Componente Zona": "", "Element Zona": "A" }, "Componente Zona"), "A");
assert.equal(navisworksTag({ "Componente Zona": "A" }, "Mi zona personalizada"), undefined);
const base = [
  { id: "1", test: "A", status: "active" },
  { id: "2", test: "A" },
  { id: "3", test: "B" },
];
const tagFixtures = [
  { "Componente Categoría": "Suelos", "Element Category": " Exacto ", "Elemento Nivel": "N01" },
  {
    "Componente Zona": "",
    "Element Zona": "A",
    "Custom Zona": "B",
    "Elemento Familia": "Colgador",
  },
  { "Componente Nivel": "N0", "Element Level": "", "Element Reference Level": "N02" },
  {},
];
for (const tags of tagFixtures) {
  const reader = createNavisworksTagReader(tags);
  for (const name of [
    "Element Category",
    "Componente Categoría",
    "Element Level",
    "Componente Nivel",
    "Element Reference Level",
    "Element Family",
    "Componente Zona",
    "Custom Zona",
    "missing",
  ])
    assert.equal(reader(name), navisworksTag(tags, name));
}
const merged = mergeTestUpdates(base, [{ id: "1", test: "A", status: "resolved" }]);
assert.deepEqual(
  merged.map((c) => c.id),
  ["3", "1"],
);
assert.equal(merged[1].status, "resolved");

const bundle = await rolldown({
  input: "src/lib/clash-parser.ts",
  platform: "node",
  resolve: { alias: { "@": path.resolve("src") } },
});
const { output } = await bundle.generate({ format: "esm" });
await bundle.close();
const { parseClashXml } = await import(
  `data:text/javascript;base64,${Buffer.from(output[0].code).toString("base64")}`
);
const fixture = (status, label, objects = "") =>
  `<exchange><batchtest><clashtests><clashtest name="A"><clashresults><clashresult guid="1" status="${status}"><resultstatus>${label}</resultstatus><clashobjects>${objects}</clashobjects></clashresult></clashresults></clashtest></clashtests></batchtest></exchange>`;
const object = `<clashobject><objectattribute><name>ID de elemento</name><value>98765</value></objectattribute><smarttags><smarttag><name>Componente Familia</name><value>Tubería</value></smarttag></smarttags></clashobject>`;
const [row] = parseClashXml(fixture("resolved", "Resuelto", object), "test");
assert.equal(row.status, "resolved");
assert.equal(row.items[0].elementId, "98765");
assert.equal(row.items[0].family, "Tubería");
assert.equal(row.items[1].elementId, undefined);
assert.equal(parseClashXml(fixture("resolved", "Resuelto"), "test")[0].status, "resolved");

for (const [index, file] of process.argv.slice(2).entries()) {
  const rows = parseClashXml(await fs.readFile(file, "utf8"), path.basename(file));
  const counts = rows.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
    return counts;
  }, {});
  if (index === 0) assert.deepEqual(counts, { active: 305, resolved: 14 });
  if (index === 1) {
    assert.equal(rows.length, 3020);
    assert.deepEqual(counts, { active: 1778, resolved: 1242 });
    assert.equal(rows[0].items[0].elementId, "12137681");
    assert.equal(rows[0].items[0].category, "Suelos");
    assert.equal(rows[0].items[1].family, "ACI_ACT_GabineteContraIncendios");
    assert.ok(rows.every((row) => !row.zona && !row.edificio && !row.sector && !row.contenedor));
  }
  console.log(path.basename(file), rows.length, counts);
}
console.log("Parser EN/ES, object IDs, missing objects and test replacement: passed");
