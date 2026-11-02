import { XMLParser } from "fast-xml-parser";
import { type Clash, type ClashItem } from "./clash-types";
import { createNavisworksTagReader, navisworksStatus, navisworksTag } from "./navisworks-values";
import { normalizeLevel } from "./clash-levels";
import {
  DEFAULT_PROJECT_CONFIG,
  getProjectFieldTag,
  getRuntimeFilterFields,
  severityForConfig,
  type ProjectConfig,
} from "./project-config";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true,
  parseAttributeValue: true,
  parseTagValue: false,
  isArray: (name) =>
    [
      "clashresult",
      "clashgroup",
      "clashtest",
      "clashobject",
      "smarttag",
      "objectattribute",
    ].includes(name),
});

function asArr<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

interface XmlProperty {
  name?: string;
  value?: string | number;
}
interface XmlObject {
  smarttags?: { smarttag?: XmlProperty | XmlProperty[] };
  objectattribute?: XmlProperty | XmlProperty[];
  layer?: string;
}
interface XmlDate {
  year?: number | string;
  month?: number | string;
  day?: number | string;
  hour?: number | string;
  minute?: number | string;
  second?: number | string;
}

function tagsToMap(smarttags: XmlObject["smarttags"]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const t of asArr(smarttags?.smarttag)) {
    const name = String(t?.name ?? "").trim();
    const value = t?.value == null ? "" : String(t.value).trim();
    if (name) map[name] = value;
  }
  return map;
}

function firstTagContaining(tags: Record<string, string>, text: string) {
  const match = Object.entries(tags).find(
    ([key, value]) =>
      key.replace(/^(Elemento|Componente) /, "Element ").includes(text) && value.trim(),
  );
  return match?.[1];
}

function buildItem(
  clashObj: XmlObject | undefined,
  config: ProjectConfig,
  runtimeFilterFields: ReturnType<typeof getRuntimeFilterFields>,
): ClashItem {
  const tags = tagsToMap(clashObj?.smarttags);
  const get = createNavisworksTagReader(tags);
  const objectId = asArr(clashObj?.objectattribute).find((attribute) =>
    navisworksTag(
      { [String(attribute?.name ?? "")]: String(attribute?.value ?? "") },
      "Element Id",
    ),
  ) as { value?: string | number } | undefined;
  const filterValues = Object.fromEntries(
    runtimeFilterFields
      .map((field) => {
        const value = get(field.sourceXmlTag);
        return [field.key, field.key === "nivel" ? normalizeLevel(value) : value] as const;
      })
      .filter(([, value]) => value),
  ) as Record<string, string>;
  // A Navisworks layer is independent of the Revit level. Do not infer a
  // missing level from it: that changes the population selected by level.
  const candidates = [
    { raw: get(getProjectFieldTag(config, "nivel")), source: "property" as const },
  ];
  const level = candidates.find((candidate) => normalizeLevel(candidate.raw));
  const nivel = normalizeLevel(level?.raw);
  // Keep the filter and displayed level aligned with the exported property.
  if (nivel) filterValues.nivel = nivel;

  return {
    elementId:
      get("Element ID elemento") ||
      get("Element Id") ||
      (objectId?.value != null ? String(objectId.value) : undefined),
    category: get(getProjectFieldTag(config, "categoria")),
    family: get("Element Family"),
    type: get("Element Tipo de elemento"),
    edificio: filterValues.edificio || get(getProjectFieldTag(config, "edificio")),
    zona: filterValues.zona || get(getProjectFieldTag(config, "zona")),
    nivel,
    nivelSource: level?.source,
    nivelRaw: level?.raw,
    volumen: get(getProjectFieldTag(config, "volumen")),
    sector: filterValues.sector || get(getProjectFieldTag(config, "sector")),
    ambiente: get("Element Ambiente"),
    codigoAmbiente: get("Element Codigo de ambiente"),
    especialidad: get("Element Especialidad"),
    idPartida: firstTagContaining(tags, "Element ID Partida"),
    container: filterValues.contenedor || get(getProjectFieldTag(config, "contenedor")),
    filterValues,
    raw: tags,
  };
}

function dateToIso(d: XmlDate | undefined): string {
  if (!d) return new Date().toISOString();
  const y = Number(d.year);
  const m = Number(d.month);
  const day = Number(d.day);
  const h = Number(d.hour ?? 0);
  const mi = Number(d.minute ?? 0);
  const s = Number(d.second ?? 0);
  if (!y || !m || !day) return new Date().toISOString();
  return new Date(Date.UTC(y, m - 1, day, h, mi, s)).toISOString();
}

function pickPair(a?: string, b?: string): string | undefined {
  const x = (a || "sin").trim();
  const y = (b || "sin").trim();
  return `${x} vs ${y}`;
}

function parsePriority(
  testName: string,
  fileName: string,
  containerName: string | undefined,
  config: ProjectConfig,
): string | undefined {
  const priority = config.prioridad;
  const source =
    priority.source === "containerName"
      ? String(containerName ?? "").trim()
      : `${testName} ${fileName}`.trim();
  const match = source.match(new RegExp(priority.regex, "i"));
  const value = match?.[priority.group];
  return priority.uppercase ? value?.toUpperCase() : value;
}

export function parseClashXml(
  xml: string,
  fileName: string,
  config: ProjectConfig = DEFAULT_PROJECT_CONFIG,
): Clash[] {
  const doc = parser.parse(xml);
  const tests = asArr(doc?.exchange?.batchtest?.clashtests?.clashtest);
  const out: Clash[] = [];
  const runtimeFilterFields = getRuntimeFilterFields(config);
  for (const test of tests) {
    const testName = String(test?.name ?? "Test");
    // Navisworks counts each top-level group as one result in its summary.
    // Keep that unit instead of dropping groups or counting their children twice.
    const results = [
      ...asArr(test?.clashresults?.clashresult).map((result) => ({
        result,
        kind: "clash" as const,
      })),
      ...asArr(test?.clashresults?.clashgroup).map((result) => ({
        result,
        kind: "group" as const,
      })),
    ];
    for (const { result: r, kind } of results) {
      const guid = String(r?.[config.guidField] ?? r?.guid ?? `${testName}-${r?.name}`);
      const signed = Number(r?.distance ?? 0) || 0;
      const dist = Math.abs(signed);
      const objs = asArr(r?.clashobjects?.clashobject);
      const items: [ClashItem, ClashItem] = [
        buildItem(objs[0], config, runtimeFilterFields),
        buildItem(objs[1], config, runtimeFilterFields),
      ];
      const pos = r?.clashpoint?.pos3f ?? {};
      const status = navisworksStatus(r?.status, r?.resultstatus);
      const zona = items[0].zona || items[1].zona;
      const nivel = items[0].nivel || items[1].nivel;
      const edificio = items[0].edificio || items[1].edificio;
      const volumen = items[0].volumen || items[1].volumen;
      const sector = items[0].sector || items[1].sector;
      const ambiente = items[0].ambiente || items[1].ambiente;
      const contenedor = items[0].container || items[1].container;
      const filterValues = Object.fromEntries(
        runtimeFilterFields
          .map(
            (field) =>
              [
                field.key,
                items[0].filterValues?.[field.key] || items[1].filterValues?.[field.key],
              ] as const,
          )
          .filter(([, value]) => value),
      ) as Record<string, string>;

      out.push({
        id: guid,
        kind,
        name: String(r?.name ?? guid),
        test: testName,
        file: fileName,
        prioridad: parsePriority(testName, fileName, contenedor, config),
        contenedor,
        status,
        sourceStatus: String(r?.status ?? r?.resultstatus ?? ""),
        testType: String(test?.test_type ?? ""),
        testTolerance: Number(test?.tolerance ?? 0),
        distance: dist,
        signedDistance: signed,
        severity: severityForConfig(dist, config),
        pos: { x: Number(pos.x) || 0, y: Number(pos.y) || 0, z: Number(pos.z) || 0 },
        gridlocation: r?.gridlocation ? String(r.gridlocation) : undefined,
        createdAt: dateToIso(r?.createddate?.date),
        items,
        zona,
        nivel,
        edificio,
        volumen,
        sector,
        ambiente,
        categoriaPair: pickPair(items[0].category, items[1].category),
        familyPair: pickPair(items[0].family, items[1].family),
        typePair: pickPair(items[0].type, items[1].type),
        filterValues,
      });
    }
  }
  return out;
}
