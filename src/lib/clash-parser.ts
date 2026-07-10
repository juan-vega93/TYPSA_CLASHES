import { XMLParser } from "fast-xml-parser";
import { type Clash, type ClashItem, type ClashStatus } from "./clash-types";
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
  isArray: (name) => ["clashresult", "clashtest", "clashobject", "smarttag"].includes(name),
});

function asArr<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function tagsToMap(smarttags: any): Record<string, string> {
  const map: Record<string, string> = {};
  for (const t of asArr(smarttags?.smarttag)) {
    const name = String(t?.name ?? "").trim();
    const value = t?.value == null ? "" : String(t.value).trim();
    if (name) map[name] = value;
  }
  return map;
}

function configuredValue(tags: Record<string, string>, sourceXmlTag: string) {
  const value = tags[sourceXmlTag];
  return value && value.trim() ? value : undefined;
}

function firstTagContaining(tags: Record<string, string>, text: string) {
  const match = Object.entries(tags).find(([key, value]) => key.includes(text) && value.trim());
  return match?.[1];
}

function buildItem(clashObj: any, config: ProjectConfig): ClashItem {
  const tags = tagsToMap(clashObj?.smarttags);
  const get = (k: string) => (tags[k] ? tags[k] : undefined);
  const runtimeFilterFields = getRuntimeFilterFields(config);
  const filterValues = Object.fromEntries(
    runtimeFilterFields
      .map((field) => [field.key, configuredValue(tags, field.sourceXmlTag)] as const)
      .filter(([, value]) => value),
  ) as Record<string, string>;

  return {
    elementId: get("Element ID elemento") || get("Element Id"),
    category: get(getProjectFieldTag(config, "categoria")),
    family: get("Element Family"),
    type: get("Element Tipo de elemento"),
    edificio: filterValues.edificio || get(getProjectFieldTag(config, "edificio")),
    zona: filterValues.zona || get(getProjectFieldTag(config, "zona")),
    nivel: filterValues.nivel || get(getProjectFieldTag(config, "nivel")),
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

function parseStatus(s: string): ClashStatus {
  const v = String(s || "").toLowerCase();
  if (v.includes("resolv")) return "resolved";
  if (v.includes("approv")) return "approved";
  if (v.includes("review")) return "reviewed";
  return "active";
}

function dateToIso(d: any): string {
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
  for (const test of tests) {
    const testName = String(test?.name ?? "Test");
    const results = asArr(test?.clashresults?.clashresult);
    for (const r of results) {
      const guid = String(r?.[config.guidField] ?? r?.guid ?? `${testName}-${r?.name}`);
      const signed = Number(r?.distance ?? 0) || 0;
      const dist = Math.abs(signed);
      const objs = asArr(r?.clashobjects?.clashobject);
      const items: [ClashItem, ClashItem] = [
        buildItem(objs[0], config),
        buildItem(objs[1] ?? objs[0], config),
      ];
      const pos = r?.clashpoint?.pos3f ?? {};
      const status = parseStatus(String(r?.resultstatus ?? r?.status ?? "active"));
      const zona = items[0].zona || items[1].zona;
      const nivel = items[0].nivel || items[1].nivel;
      const edificio = items[0].edificio || items[1].edificio;
      const volumen = items[0].volumen || items[1].volumen;
      const sector = items[0].sector || items[1].sector;
      const ambiente = items[0].ambiente || items[1].ambiente;
      const contenedor = items[0].container || items[1].container;
      const runtimeFilterFields = getRuntimeFilterFields(config);
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
        name: String(r?.name ?? guid),
        test: testName,
        file: fileName,
        prioridad: parsePriority(testName, fileName, contenedor, config),
        contenedor,
        status,
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
