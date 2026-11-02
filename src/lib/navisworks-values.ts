function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function propertyKey(value: string) {
  const key = normalize(value).replace(/^(element|elemento|componente)\s+/, "");
  const aliases: Record<string, string> = {
    category: "categoria",
    family: "familia",
    volume: "volumen",
    level: "nivel",
    "reference level": "nivel de referencia",
    "id elemento": "id",
    "id de elemento": "id",
    "element id": "id",
  };
  return aliases[key] ?? key;
}

// Exact configured names win. Known EN/ES labels remain interchangeable.
export function navisworksTag(tags: Record<string, string>, name: string) {
  if (tags[name]?.trim()) return tags[name].trim();
  const key = propertyKey(name);
  return Object.entries(tags).find(
    ([label, value]) => value.trim() && propertyKey(label) === key,
  )?.[1];
}

/** Parser-local lookup for immutable exported property bags. Preserves exact-name precedence. */
export function createNavisworksTagReader(tags: Record<string, string>) {
  let index: Map<string, string> | undefined;
  return (name: string) => {
    if (tags[name]?.trim()) return tags[name].trim();
    if (!index) {
      index = new Map();
      for (const [label, value] of Object.entries(tags)) {
        if (!value.trim()) continue;
        const key = propertyKey(label);
        if (!index.has(key)) index.set(key, value);
      }
    }
    return index.get(propertyKey(name));
  };
}

const STATUSES = {
  new: "active",
  nuevo: "active",
  active: "active",
  activo: "active",
  reviewed: "reviewed",
  revisado: "reviewed",
  approved: "approved",
  aprobado: "approved",
  resolved: "resolved",
  resuelto: "resolved",
} as const;

export function navisworksStatus(attribute: unknown, label: unknown) {
  const parse = (value: unknown) =>
    STATUSES[normalize(String(value ?? "")) as keyof typeof STATUSES];
  // Navisworks keeps the machine attribute in English across UI languages.
  return parse(attribute) ?? parse(label) ?? "active";
}
