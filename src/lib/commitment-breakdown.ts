import type { CutBalance } from "./commitment-control";
import { movementTotals } from "./commitment-control";
import { specialtyOf } from "./coordination-priority";
import type { Clash } from "./clash-types";

export const testPair = (test: string) => specialtyOf({ test } as Clash);
export const testSpecialties = (test: string) => [...new Set(testPair(test).split(" × "))];
export interface BreakdownRow {
  label: string;
  opening: number;
  pending: number;
  entries: number;
  closed: number;
  exits: number;
}
export function commitmentBreakdown(cut: CutBalance, mode: "pair" | "test"): BreakdownRow[] {
  const groups = new Map<string, BreakdownRow>();
  for (const [test, value] of Object.entries(cut.byTest ?? {})) {
    const label = mode === "test" ? test : testPair(test);
    const row = groups.get(label) ?? {
      label,
      opening: 0,
      pending: 0,
      entries: 0,
      closed: 0,
      exits: 0,
    };
    const totals = movementTotals({ counts: value.counts } as CutBalance);
    row.opening += value.opening;
    row.pending += value.pending;
    row.entries += totals.entries;
    row.closed += value.counts.closed;
    row.exits += totals.otherExits;
    groups.set(label, row);
  }
  return [...groups.values()].sort(
    (a, b) => b.entries - a.entries || a.label.localeCompare(b.label),
  );
}
const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
export function breakdownSvg(rows: BreakdownRow[]) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.entries, r.closed]));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="${120 + rows.length * 62}" viewBox="0 0 1120 ${120 + rows.length * 62}" role="img" aria-label="Entradas y cierres por test o par de especialidades"><rect width="100%" height="100%" fill="white"/><g font-family="Arial" fill="#203b43"><text x="30" y="30" font-size="22">¿En qué encuentros aumentó la carga y cuántos cerramos?</text><text x="30" y="60" font-size="15">Naranja: entradas de pendientes · Verde: cierres XML · Ordenado por entradas</text>${rows
    .map((r, i) => {
      const y = 95 + i * 62;
      return `<text x="25" y="${y + 15}" font-size="15">${esc(r.label)}</text><rect x="240" y="${y}" width="${(r.entries / max) * 600}" height="17" fill="#d97706"/><text x="${250 + (r.entries / max) * 600}" y="${y + 14}" font-size="14">${r.entries.toLocaleString("es-PE")}</text><rect x="240" y="${y + 23}" width="${(r.closed / max) * 600}" height="17" fill="#059669"/><text x="${250 + (r.closed / max) * 600}" y="${y + 37}" font-size="14">${r.closed.toLocaleString("es-PE")}</text>`;
    })
    .join("")}</g></svg>`;
}
