import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { rolldown } from "rolldown";
async function mod(input) {
  const b = await rolldown({
    input,
    platform: "node",
    resolve: { alias: { "@": path.resolve("src") } },
  });
  const { output } = await b.generate({ format: "esm" });
  await b.close();
  return import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString("base64")}`);
}
const { parseClashXml } = await mod("src/lib/clash-parser.ts");
const { buildClashIndex, queryClashes, MISSING_LEVEL } = await mod("src/lib/clash-query.ts");
const { DEFAULT_PROJECT_CONFIG } = await mod("src/lib/project-config.ts");
const { normalizeLevel } = await mod("src/lib/clash-levels.ts");
const { classifyCoordination, DEFAULT_COORDINATION_RULES, coordinationPair } = await mod(
  "src/lib/coordination-priority.ts",
);
const html = await fs.readFile(
  process.argv[2] || "C:/Users/jjvega/Desktop/Tablero-EST-Especialidades-P3.HTML",
  "utf8",
);
const start = html.indexOf("window.DATA=") + "window.DATA=".length;
const data = JSON.parse(html.slice(start, html.indexOf(";</script>", start)));
let checks = 0,
  total = 0;
for (const test of data.tests) {
  const xml = await fs.readFile(test.source, "utf8");
  assert.equal(
    crypto.createHash("sha256").update(xml).digest("hex"),
    test.sha256.toLowerCase(),
    `${test.name}: source hash`,
  );
  const parsed = parseClashXml(xml, test.source);
  const ref = data.rows.filter((r) => r.test === test.name);
  assert.equal(parsed.length, ref.length);
  total += parsed.length;
  const byId = new Map(ref.map((r) => [r.guid, r]));
  for (const row of parsed) {
    const raw = byId.get(row.id);
    assert.ok(raw, `${test.name}: missing GUID ${row.id}`);
    for (let i = 0; i < 2; i++)
      assert.equal(
        row.items[i].nivel,
        normalizeLevel(raw.objects[i]?.properties?.["Componente Nivel"]),
        `${test.name} ${row.id} object ${i}: property level`,
      );
  }
  const index = buildClashIndex(parsed, DEFAULT_PROJECT_CONFIG);
  const levels = new Set(
    ref.flatMap((r) =>
      [0, 1].map(
        (i) => normalizeLevel(r.objects[i]?.properties?.["Componente Nivel"]) || MISSING_LEVEL,
      ),
    ),
  );
  for (const source of ["a", "b", "either"])
    for (const level of levels) {
      const expected = ref
        .filter((r) => {
          const values = [0, 1].map((i) =>
            normalizeLevel(r.objects[i]?.properties?.["Componente Nivel"]),
          );
          return source === "either"
            ? level === MISSING_LEVEL
              ? values.every((v) => !v)
              : values.includes(level)
            : (values[source === "a" ? 0 : 1] || MISSING_LEVEL) === level;
        })
        .map((r) => r.guid)
        .sort();
      assert.deepEqual(
        queryClashes(index, { nivel: [level], nivelSource: source })
          .map((r) => r.id)
          .sort(),
        expected,
        `${test.name} ${source} ${level}`,
      );
      checks++;
    }
  if (test.name === "P1_EST-ACI") {
    const selected = queryClashes(index, { nivel: ["AS2", "N00"], nivelSource: "either" });
    const pending = parsed.filter((r) => r.status === "active" || r.status === "reviewed");
    const classes = Object.fromEntries(
      ["C1", "C2", "C3", "C4"].map((k) => [
        k,
        pending.filter((r) => classifyCoordination(r, DEFAULT_COORDINATION_RULES) === k).length,
      ]),
    );
    assert.equal(
      classes.C1 + classes.C2,
      pending.filter((r) => {
        const raw = byId.get(r.id);
        return (
          raw.objects.length === 2 &&
          !/colgador/i.test(raw.objects[1]?.properties["Componente Familia"] || "") &&
          ["Pilares estructurales", "Armazón estructural", "Cimentación estructural"].includes(
            raw.objects[0]?.properties["Componente Categoría"],
          )
        );
      }).length,
    );
    assert.ok(pending.some((r) => coordinationPair(r).some((label) => label.includes("Colgador"))));
    console.log(test.name, {
      total: parsed.length,
      pending: pending.length,
      AS2_N00: {
        total: selected.length,
        pending: selected.filter((r) => r.status === "active" || r.status === "reviewed").length,
      },
      classes,
    });
  }
}
console.log("Source hashes, GUIDs, property levels and per-object filter membership matched:", {
  tests: data.tests.length,
  total,
  filterChecks: checks,
});
