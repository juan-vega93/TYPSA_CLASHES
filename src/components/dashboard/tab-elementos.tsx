import { useMemo } from "react";
import type { Clash } from "@/lib/clash-types";
import { Panel } from "./panel";

function topPairs(clashes: Clash[], key: "categoriaPair" | "familyPair" | "typePair", n = 8) {
  const m = new Map<string, number>();
  for (const c of clashes) {
    const k = c[key];
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function Ranking({ data, max }: { data: { label: string; count: number }[]; max: number }) {
  if (data.length === 0) {
    return <div className="py-6 text-center text-sm text-muted-foreground">Sin datos</div>;
  }
  return (
    <div className="space-y-3">
      {data.map((d) => {
        const w = max === 0 ? 0 : (d.count / max) * 100;
        return (
          <div key={d.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="truncate pr-3 text-foreground">{d.label}</span>
              <span className="font-semibold tabular-nums text-foreground">{d.count}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${w}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ElementosTab({ clashes }: { clashes: Clash[] }) {
  const cats = useMemo(() => topPairs(clashes, "categoriaPair"), [clashes]);
  const types = useMemo(() => topPairs(clashes, "typePair"), [clashes]);
  const fams = useMemo(() => topPairs(clashes, "familyPair"), [clashes]);

  const topIds = useMemo(() => {
    const m = new Map<string, { count: number; maxPen: number; family?: string; category?: string; type?: string }>();
    for (const c of clashes) {
      for (const it of c.items) {
        const id = it.elementId;
        if (!id) continue;
        const cur = m.get(id) ?? { count: 0, maxPen: 0, family: it.family, category: it.category, type: it.type };
        cur.count += 1;
        if (c.distance > cur.maxPen) cur.maxPen = c.distance;
        m.set(id, cur);
      }
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [clashes]);

  const maxCat = cats[0]?.count ?? 0;
  const maxType = types[0]?.count ?? 0;
  const maxFam = fams[0]?.count ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Pares de categorías">
        <Ranking data={cats} max={maxCat} />
      </Panel>
      <Panel title="Pares de tipos">
        <Ranking data={types} max={maxType} />
      </Panel>
      <Panel title="Pares de familias">
        <Ranking data={fams} max={maxFam} />
      </Panel>
      <Panel title="Element IDs más conflictivos">
        {topIds.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Sin Element IDs disponibles en los datos filtrados.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Element ID</th>
                  <th className="px-3 py-2 text-left font-medium">Familia</th>
                  <th className="px-3 py-2 text-left font-medium">Categoría</th>
                  <th className="px-3 py-2 text-right font-medium">Clashes</th>
                  <th className="px-3 py-2 text-right font-medium">Max pen.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topIds.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono">{r.id}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.family ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.category ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold">{r.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.maxPen.toFixed(3)} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}