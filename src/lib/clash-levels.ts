/** Canonical level label; the caller keeps the exported property in item.raw. */
export function normalizeLevel(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  let name = value.trim().replace(/\s+/g, " ");
  // Strip only a recognized Revit reference, never an arbitrary quoted substring.
  const reference = name.match(/^(?:Level|Nivel)\s+["“]([^"“”]*)["”](?:\s*,?\s*#\d+)?$/i);
  if (reference) name = reference[1].trim();
  if (!name) return undefined;
  if (/^<?\s*(?:sin nivel|no level)\s*>?$/i.test(name)) return undefined;
  // Explicit aliases used by the supplied coordination dashboard.
  if (/^S[12]$/i.test(name)) return `NS${name.slice(1)}`;
  const codes = new Set(
    [...name.toUpperCase().matchAll(/(?:^|[^A-Z0-9])((?:NS|AS|N)\d{1,2})(?=$|[^A-Z0-9])/g)].map(
      (match) => {
        const code = match[1].match(/^(NS|AS|N)(\d+)$/)!;
        const number = Number(code[2]);
        return `${code[1]}${code[1] === "N" ? String(number).padStart(2, "0") : number}`;
      },
    ),
  );
  // Multiple different codes cannot safely be collapsed to one floor.
  return codes.size === 1 ? [...codes][0] : name;
}
