import { useMemo, useState, useEffect } from "react";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { Clash } from "@/lib/clash-types";
import { Panel } from "./panel";

const SEV_COLORS = {
  alta: "var(--sev-alta)",
  media: "var(--sev-media)",
  baja: "var(--sev-baja)",
} as const;

const MAX_SCATTER_POINTS = 5000;

export function UbicacionTab({
  clashes,
  globalBounds,
}: {
  clashes: Clash[];
  globalBounds: { xMin: number; xMax: number; yMin: number; yMax: number };
}) {
  // Background image for the site plan (place your raster/SVG in `public/mi-plano.svg` or change this path)
  const BG_IMAGE = "/plano.png";
  const { zonas, niveles, matrix, max } = useMemo(() => {
    const zSet = new Map<string, number>();
    const nSet = new Map<string, number>();
    for (const c of clashes) {
      if (c.zona) zSet.set(c.zona, (zSet.get(c.zona) ?? 0) + 1);
      if (c.nivel) nSet.set(c.nivel, (nSet.get(c.nivel) ?? 0) + 1);
    }
    const zonas = Array.from(zSet.keys()).sort((a, b) => (zSet.get(b)! - zSet.get(a)!)).slice(0, 14);
    const niveles = Array.from(nSet.keys()).sort();
    const matrix: number[][] = zonas.map(() => niveles.map(() => 0));
    const zonaIndex = new Map(zonas.map((z, i) => [z, i]));
    const nivelIndex = new Map(niveles.map((n, i) => [n, i]));
    let max = 0;
    for (const c of clashes) {
      const zi = zonaIndex.get(c.zona ?? "") ?? -1;
      const ni = nivelIndex.get(c.nivel ?? "") ?? -1;
      if (zi >= 0 && ni >= 0) {
        matrix[zi][ni] += 1;
        if (matrix[zi][ni] > max) max = matrix[zi][ni];
      }
    }
    return { zonas, niveles, matrix, max };
  }, [clashes]);

  // scatter uses absolute coordinates (real world) so tooltip shows true X/Y
  const scatter = useMemo(() => {
    const points = clashes.filter((c) => c.pos.x !== 0 || c.pos.y !== 0);
    const step = Math.max(1, Math.ceil(points.length / MAX_SCATTER_POINTS));
    const sampled = step === 1 ? points : points.filter((_, index) => index % step === 0);
    return sampled.map((c) => ({
        x: c.pos.x,
        y: c.pos.y,
        z: Math.max(6, c.distance * 300),
        severity: c.severity,
        name: c.name,
        zona: c.zona,
        nivel: c.nivel,
        edificio: c.edificio,
        file: c.file,
      }));
  }, [clashes]);

  const scatterBySeverity = useMemo(() => {
    const grouped = {
      alta: [] as typeof scatter,
      media: [] as typeof scatter,
      baja: [] as typeof scatter,
    };
    for (const point of scatter) {
      grouped[point.severity].push(point);
    }
    return grouped;
  }, [scatter]);

  // compute bounds for the chart (with small margin)
  const bounds = useMemo(() => {
    if (scatter.length === 0) return { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const s of scatter) {
      xMin = Math.min(xMin, s.x);
      xMax = Math.max(xMax, s.x);
      yMin = Math.min(yMin, s.y);
      yMax = Math.max(yMax, s.y);
    }
    const xPad = Math.max(1, (xMax - xMin) * 0.05);
    const yPad = Math.max(1, (yMax - yMin) * 0.05);
    return { xMin: xMin - xPad, xMax: xMax + xPad, yMin: yMin - yPad, yMax: yMax + yPad };
  }, [scatter]);

  // allow user to choose whether to use global bounds (points fixed) or per-filter bounds
  const [useGlobal, setUseGlobal] = useState(true);
  const [overrideBounds, setOverrideBounds] = useState<{ xMin: number; xMax: number; yMin: number; yMax: number } | null>(null);

  // initialize override to global on first load
  useEffect(() => {
    setOverrideBounds(globalBounds);
  }, [globalBounds.xMin, globalBounds.xMax, globalBounds.yMin, globalBounds.yMax]);

  const activeBounds = useMemo(() => {
    if (useGlobal) return overrideBounds ?? globalBounds;
    return bounds;
  }, [useGlobal, overrideBounds, globalBounds, bounds]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Mapa de calor · Zona × Nivel">
        {zonas.length === 0 || niveles.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sin datos de zona/nivel para los filtros actuales.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th />
                  {niveles.map((n) => (
                    <th key={n} className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zonas.map((z, zi) => (
                  <tr key={z}>
                    <td className="whitespace-nowrap py-1 pr-2 text-right text-[11px] text-muted-foreground">
                      {z.length > 20 ? z.slice(0, 18) + "…" : z}
                    </td>
                    {niveles.map((_, ni) => {
                      const v = matrix[zi][ni];
                      const intensity = max === 0 ? 0 : v / max;
                      return (
                        <td
                          key={ni}
                          className="h-8 min-w-10 rounded text-center align-middle font-semibold"
                          style={{
                            backgroundColor:
                              v === 0
                                ? "var(--muted)"
                                : `color-mix(in oklab, var(--primary) ${Math.round(20 + intensity * 75)}%, var(--card))`,
                            color: intensity > 0.4 ? "white" : "var(--foreground)",
                          }}
                        >
                          {v > 0 ? v : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Mapa espacial - ${scatter.length} puntos visibles`}>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={useGlobal} onChange={(e) => setUseGlobal(e.target.checked)} />
              <span>Usar límites globales (fijar ubicación)</span>
            </label>
            <div className="ml-4 grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-muted-foreground">
                <span className="min-w-[40px]">xMin</span>
                <input
                  className="w-full rounded border px-2 py-1 text-xs"
                  value={overrideBounds?.xMin ?? activeBounds.xMin}
                  onChange={(e) => setOverrideBounds({ ...(overrideBounds ?? activeBounds), xMin: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-2 text-muted-foreground">
                <span className="min-w-[40px]">xMax</span>
                <input
                  className="w-full rounded border px-2 py-1 text-xs"
                  value={overrideBounds?.xMax ?? activeBounds.xMax}
                  onChange={(e) => setOverrideBounds({ ...(overrideBounds ?? activeBounds), xMax: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-2 text-muted-foreground">
                <span className="min-w-[40px]">yMin</span>
                <input
                  className="w-full rounded border px-2 py-1 text-xs"
                  value={overrideBounds?.yMin ?? activeBounds.yMin}
                  onChange={(e) => setOverrideBounds({ ...(overrideBounds ?? activeBounds), yMin: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-2 text-muted-foreground">
                <span className="min-w-[40px]">yMax</span>
                <input
                  className="w-full rounded border px-2 py-1 text-xs"
                  value={overrideBounds?.yMax ?? activeBounds.yMax}
                  onChange={(e) => setOverrideBounds({ ...(overrideBounds ?? activeBounds), yMax: Number(e.target.value) })}
                />
              </label>
            </div>
          </div>
          <div className="h-[380px]">
            <ResponsiveContainer
              debounce={50}
              style={{
                backgroundImage: `url(${BG_IMAGE})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <ScatterChart margin={{ left: 8, right: 12, top: 10, bottom: 10 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  type="number"
                  name="E/W"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  domain={[activeBounds.xMin, activeBounds.xMax]}
                />
                <YAxis
                  dataKey="y"
                  type="number"
                  name="N/S"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  domain={[activeBounds.yMin, activeBounds.yMax]}
                />
                <ZAxis dataKey="z" range={[10, 120]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />
                <Legend />

                {(["alta", "media", "baja"] as const).map((sev) => {
                  const data = scatterBySeverity[sev];
                  return (
                    <Scatter key={sev} name={sev.toUpperCase()} data={data} fill={SEV_COLORS[sev]} fillOpacity={0.9} />
                  );
                })}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md bg-card p-2 text-xs shadow">
      <div className="font-medium">{p.name}</div>
      <div>X: {Number(p.x).toFixed(3)}</div>
      <div>Y: {Number(p.y).toFixed(3)}</div>
      {p.edificio ? <div>Edificio: {p.edificio}</div> : null}
      {p.zona ? <div>Zona: {p.zona}</div> : null}
      {p.nivel ? <div>Nivel: {p.nivel}</div> : null}
      {p.file ? <div className="text-muted-foreground">{p.file}</div> : null}
    </div>
  );
}
