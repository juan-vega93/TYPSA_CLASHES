import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  buildImportanceMatrix,
  classifyImportance,
  encounterGroup,
} from "../src/lib/clash-importance.ts";

const clash = (id, a, b, severity = "baja", test = "P1_EST-ACI") => ({
  id,
  test,
  severity,
  status: "active",
  items: [a, b],
});
const column = { category: "Structural Columns", family: "Column" };
const pipe = { category: "Tuberías", family: "Tipos de tubería" };
const hanger = { category: "Accesorios de tuberías", family: "ACI_ACT_Colgador" };
const floor = { category: "Suelos", family: "Suelo" };
const cases = [
  clash("1", column, pipe),
  clash("2", column, hanger),
  clash("3", floor, pipe),
  clash("4", floor, pipe, "alta"),
  clash("5", {}, pipe, "alta"),
];
assert.equal(classifyImportance(cases[0]).importance, "relevant");
assert.equal(classifyImportance(cases[1]).importance, "outside");
assert.equal(classifyImportance(cases[1], false).importance, "relevant");
assert.equal(classifyImportance(cases[2]).importance, "review");
assert.equal(classifyImportance(cases[3]).importance, "relevant");
assert.equal(classifyImportance(cases[4]).importance, "review");
assert.equal(classifyImportance(clash("6", pipe, column)).importance, "relevant");
assert.equal(
  encounterGroup({ category: "Armazón estructural", family: "VigadeCimentacion" }),
  "Armazón estructural",
);
assert.equal(encounterGroup({ category: "Nueva categoría" }), "Nueva categoría");
assert.equal(encounterGroup({ category: "Pilares estructurales" }), "Pilares estructurales");
assert.equal(encounterGroup({ category: "Pipes" }), "Pipes");
assert.equal(encounterGroup(hanger), "Accesorios de tuberías");
assert.equal(
  encounterGroup({ category: "", family: "ACI_ACT_Colgador" }),
  "Categoría no exportada",
);
assert.equal(
  encounterGroup({
    category: "Parámetro personalizado",
    raw: { "Componente Categoría": "Suelos" },
  }),
  "Suelos",
);
assert.equal(
  encounterGroup({ raw: { "Element Category": "Structural Columns" } }),
  "Structural Columns",
);
assert.equal(
  classifyImportance(clash("raw", { raw: { "Element Category": "Structural Columns" } }, pipe))
    .importance,
  "relevant",
);
const matrix = buildImportanceMatrix(cases);
assert.deepEqual(matrix.counts, { relevant: 2, review: 2, outside: 1 });
assert.equal(
  [...matrix.cells.values()].reduce((sum, cell) => sum + cell.count, 0),
  cases.length,
);
assert.equal(
  [...matrix.rowTotals.values()].reduce((sum, count) => sum + count, 0),
  cases.length,
);
assert.equal(
  [...matrix.columnTotals.values()].reduce((sum, count) => sum + count, 0),
  cases.length,
);
assert.deepEqual(matrix.cells.get(JSON.stringify(["Suelos", "Tuberías"])).counts, {
  relevant: 1,
  review: 1,
  outside: 0,
});
assert.equal(cases[1].status, "active");
const other = buildImportanceMatrix([
  clash("7", { category: "Conductos" }, { category: "Bandejas de cables" }, "media", "P2_IME-IEL"),
]);
assert.deepEqual(other.rows, ["Conductos"]);
assert.deepEqual(other.columns, ["Bandejas de cables"]);
assert.deepEqual(buildImportanceMatrix([]).rows, []);

// Read only the reference data JSON; never execute the HTML's scripts.
if (process.argv[2]) {
  const html = await fs.readFile(process.argv[2], "utf8");
  const marker = "window.CLASH_DATA=";
  const start = html.indexOf(marker) + marker.length;
  const end = html.indexOf(";</script>", start);
  const data = JSON.parse(html.slice(start, end));
  const rows = data.rows
    .filter((row) => row.status !== "resolved" && row.status !== "approved")
    .map((row) =>
      clash(
        row.guid,
        ...[0, 1].map((index) => ({
          category: row.objects[index]?.properties["Componente Categoría"],
          family: row.objects[index]?.properties["Componente Familia"],
        })),
        Math.abs(Number(row.distance_m)) >= 0.1 ? "alta" : "baja",
      ),
    );
  const actual = buildImportanceMatrix(rows);
  assert.equal(rows.length, 1778);
  assert.equal(
    Object.values(actual.counts).reduce((sum, count) => sum + count, 0),
    rows.length,
  );
  console.log(
    "Reference: 1778 pending clashes",
    actual.counts,
    `${actual.rows.length} × ${actual.columns.length} matrix`,
  );
}
console.log(
  "Importance: dynamic axes, EN/ES, mixed cells, incomplete data and hanger toggle passed",
);
