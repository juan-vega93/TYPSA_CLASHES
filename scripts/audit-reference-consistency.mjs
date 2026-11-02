import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { rolldown } from "rolldown";
import { normalizeLevel } from "../src/lib/clash-levels.ts";

const [htmlPath, directory, outputPath] = process.argv.slice(2);
if (!htmlPath || !directory) throw Error("Provide HTML reference and XML directory");
const html = await fs.readFile(htmlPath, "utf8");
const marker = "window.DATA=";
const start = html.indexOf(marker);
if (start < 0) throw Error("Reference data not found");
const data = JSON.parse(html.slice(start + marker.length, html.indexOf(";</script>", start)));
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
const stats = (rows, field) =>
  rows.reduce((result, row) => {
    const key = field(row);
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
const canonical = (raw) => {
  const level = normalizeLevel(raw);
  return { S1: "NS1", S2: "NS2", "NIV-+0.00": "N00" }[level] ?? level;
};
const selected = new Set(["AS2", "N00", "NS1", "NS2"]);
const referenceLevel = (item) =>
  canonical(
    item?.properties?.["Componente Nivel"] || item?.properties?.["Componente Nivel de referencia"],
  );
const report = {
  reference: path.basename(htmlPath),
  xmlDirectory: directory,
  selectedLevels: [...selected],
  basis: "either",
  tests: [],
};
for (const test of data.tests) {
  const file = path.join(directory, `${test.name}.xml`);
  let bytes;
  try {
    bytes = await fs.readFile(file);
  } catch {
    report.tests.push({ test: test.name, missingXml: true });
    continue;
  }
  const rows = parseClashXml(bytes.toString("utf8"), path.basename(file));
  const reference = data.rows.filter((row) => row.test === test.name);
  const currentIds = new Set(rows.map((row) => row.id));
  const referenceIds = new Set(reference.map((row) => row.guid));
  const referenceById = new Map(reference.map((row) => [row.guid, row]));
  const referenceOnly = reference.filter((row) => !currentIds.has(row.guid));
  const xmlOnly = rows.filter((row) => !referenceIds.has(row.id));
  const refScope = reference.filter((row) =>
    [0, 1].some((i) => selected.has(referenceLevel(row.objects[i]))),
  );
  const currentScope = rows.filter((row) =>
    row.items.some((item) => selected.has(canonical(item.nivel))),
  );
  const propertyScope = rows.filter((row) =>
    row.items.some((item) =>
      selected.has(
        canonical(item.raw?.["Componente Nivel"] || item.raw?.["Componente Nivel de referencia"]),
      ),
    ),
  );
  report.tests.push({
    test: test.name,
    sameFileHash:
      crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase() ===
      test.sha256.toUpperCase(),
    referenceHash: test.sha256,
    xmlHash: crypto.createHash("sha256").update(bytes).digest("hex"),
    reference: {
      total: reference.length,
      statuses: stats(reference, (row) => row.status),
      scoped: refScope.length,
      scopedStatuses: stats(refScope, (row) => row.status),
    },
    xml: {
      total: rows.length,
      statuses: stats(rows, (row) => row.status),
      scopedCurrentReader: currentScope.length,
      scopedStatuses: stats(currentScope, (row) => row.status),
      scopedWithReferenceProperties: propertyScope.length,
      scopedPropertyStatuses: stats(propertyScope, (row) => row.status),
    },
    sharedGuids: rows.filter((row) => referenceIds.has(row.id)).length,
    sharedStatusChanges: rows.filter(
      (row) => referenceById.has(row.id) && row.sourceStatus !== referenceById.get(row.id).status,
    ).length,
    sharedLevelPropertyChanges: rows.filter((row) => {
      const other = referenceById.get(row.id);
      return (
        other &&
        [0, 1].some((index) =>
          ["Componente Nivel", "Componente Nivel de referencia"].some(
            (tag) =>
              (row.items[index].raw?.[tag] ?? "") !==
              (other.objects[index]?.properties?.[tag] ?? ""),
          ),
        )
      );
    }).length,
    onlyInReference: referenceOnly.length,
    onlyInReferenceStatuses: stats(referenceOnly, (row) => row.status),
    onlyInXml: xmlOnly.length,
    onlyInXmlKinds: stats(xmlOnly, (row) => row.kind),
    onlyInXmlGroups: xmlOnly
      .filter((row) => row.kind === "group")
      .map((row) => ({ guid: row.id, name: row.name })),
  });
}
if (outputPath) await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
