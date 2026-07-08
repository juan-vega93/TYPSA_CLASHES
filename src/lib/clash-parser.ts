import { XMLParser } from "fast-xml-parser";
import { type Clash, type ClashItem, type ClashStatus, severityFor } from "./clash-types";

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

function buildItem(clashObj: any): ClashItem {
  const tags = tagsToMap(clashObj?.smarttags);
  const get = (k: string) => (tags[k] ? tags[k] : undefined);
  return {
    elementId: get("Element ID elemento") || get("Element Id"),
    category: get("Element Category"),
    family: get("Element Family"),
    type: get("Element Tipo de elemento"),
    edificio: get("Element Edificio"),
    zona: get("Element Zona"),
    nivel: get("Element Nivel"),
    sector: get("Element Sector"),
    ambiente: get("Element Ambiente"),
    codigoAmbiente: get("Element Codigo de ambiente"),
    especialidad: get("Element Especialidad"),
    idPartida: get("Element ID Partida N°01") || get("Element ID Partida N01"),
    container: get("Element Contenedor Origen"),
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

function parsePriority(testName: string, fileName: string): string | undefined {
  const source = `${testName} ${fileName}`.trim();
  const match = source.match(/\b(P\d+)[_-]/i) ?? source.match(/\b(P\d+)\b/i);
  return match?.[1]?.toUpperCase();
}

export function parseClashXml(xml: string, fileName: string): Clash[] {
  const doc = parser.parse(xml);
  const tests = asArr(doc?.exchange?.batchtest?.clashtests?.clashtest);
  const out: Clash[] = [];
  for (const test of tests) {
    const testName = String(test?.name ?? "Test");
    const results = asArr(test?.clashresults?.clashresult);
    for (const r of results) {
      const guid = String(r?.guid ?? `${testName}-${r?.name}`);
      const signed = Number(r?.distance ?? 0) || 0;
      const dist = Math.abs(signed);
      const objs = asArr(r?.clashobjects?.clashobject);
      const items: [ClashItem, ClashItem] = [
        buildItem(objs[0]),
        buildItem(objs[1] ?? objs[0]),
      ];
      const pos = r?.clashpoint?.pos3f ?? {};
      const status = parseStatus(String(r?.resultstatus ?? r?.status ?? "active"));
      const zona = items[0].zona || items[1].zona;
      const nivel = items[0].nivel || items[1].nivel;
      const edificio = items[0].edificio || items[1].edificio;
      const sector = items[0].sector || items[1].sector;
      const ambiente = items[0].ambiente || items[1].ambiente;
      const contenedor = items[0].container || items[1].container;
      out.push({
        id: guid,
        name: String(r?.name ?? guid),
        test: testName,
        file: fileName,
        prioridad: parsePriority(testName, fileName),
        contenedor,
        status,
        distance: dist,
        signedDistance: signed,
        severity: severityFor(dist),
        pos: { x: Number(pos.x) || 0, y: Number(pos.y) || 0, z: Number(pos.z) || 0 },
        gridlocation: r?.gridlocation ? String(r.gridlocation) : undefined,
        createdAt: dateToIso(r?.createddate?.date),
        items,
        zona,
        nivel,
        edificio,
        sector,
        ambiente,
        categoriaPair: pickPair(items[0].category, items[1].category),
        familyPair: pickPair(items[0].family, items[1].family),
        typePair: pickPair(items[0].type, items[1].type),
      });
    }
  }
  return out;
}
