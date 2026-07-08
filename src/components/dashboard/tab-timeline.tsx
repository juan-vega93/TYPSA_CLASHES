import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Clash, ClashSnapshot } from "@/lib/clash-types";
import type { ClashOverride } from "@/lib/use-clash-state";
import { Panel } from "./panel";

function dateKey(iso: string) {
  return iso.slice(0, 10);
}

function fallbackSeries(clashes: Clash[], overrides: Record<string, ClashOverride>) {
  const created: Record<string, number> = {};
  const resolved: Record<string, number> = {};
  for (const c of clashes) {
    const k = dateKey(c.createdAt);
    created[k] = (created[k] ?? 0) + 1;
    const o = overrides[c.id];
    const resolvedAt = o?.resolvedAt ?? (c.status !== "active" ? c.createdAt : undefined);
    if (resolvedAt) {
      const rk = dateKey(resolvedAt);
      resolved[rk] = (resolved[rk] ?? 0) + 1;
    }
  }
  const dates = Array.from(new Set([...Object.keys(created), ...Object.keys(resolved)])).sort();
  let cumCreated = 0;
  let cumResolved = 0;
  return dates.map((d) => {
    cumCreated += created[d] ?? 0;
    cumResolved += resolved[d] ?? 0;
    return {
      date: d,
      nuevos: created[d] ?? 0,
      creados: cumCreated,
      resueltos: cumResolved,
      pendientes: Math.max(0, cumCreated - cumResolved),
    };
  });
}

function snapshotSeries(snapshots: ClashSnapshot[]) {
  const ordered = snapshots
    .filter((snapshot) => snapshot.clashes.length > 0)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const everSeen = new Set<string>();
  return ordered.map((snapshot) => {
    const active = new Set<string>();
    const current = new Set<string>();
    let nuevos = 0;

    for (const clash of snapshot.clashes) {
      current.add(clash.id);
      if (!everSeen.has(clash.id)) nuevos += 1;
      if (clash.status === "active") active.add(clash.id);
    }

    for (const id of current) everSeen.add(id);

    return {
      date: snapshot.date,
      snapshot: snapshot.label,
      nuevos,
      creados: everSeen.size,
      resueltos: Math.max(0, everSeen.size - active.size),
      pendientes: active.size,
    };
  });
}

export function TimelineTab({
  clashes,
  snapshots,
  overrides,
}: {
  clashes: Clash[];
  snapshots: ClashSnapshot[];
  overrides: Record<string, ClashOverride>;
}) {
  const series = useMemo(() => {
    if (snapshots.length > 1) return snapshotSeries(snapshots);
    return fallbackSeries(clashes, overrides);
  }, [clashes, overrides, snapshots]);

  const latest = series[series.length - 1];
  const total = latest?.creados ?? clashes.length;
  const resolvedNow = latest?.resueltos ?? clashes.filter((c) => (overrides[c.id]?.status ?? c.status) !== "active").length;
  const pendingNow = latest?.pendientes ?? Math.max(0, total - resolvedNow);
  const pct = total === 0 ? 0 : Math.round((resolvedNow / total) * 100);

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Kpi label="% Avance" value={`${pct}%`} hint={`${resolvedNow} / ${total} resueltos`} />
        <Kpi label="Pendientes" value={String(pendingNow)} hint="Activos en el ultimo snapshot" />
        <Kpi
          label="Ratio de cierre"
          value={
            series.length <= 1
              ? "-"
              : `${(resolvedNow / Math.max(series.length - 1, 1)).toFixed(1)}/snapshot`
          }
          hint="Promedio entre fechas cargadas"
        />
      </div>

      <Panel
        title="Resolucion historica por carpeta"
        subtitle="Cada punto usa los XML guardados en carpetas YYMMDD o YYYYMMDD dentro de src/data."
      >
        {series.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sin eventos temporales todavia.
          </div>
        ) : (
          <div className="h-[380px]">
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--sev-baja)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--sev-baja)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--sev-media)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--sev-media)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="creados"
                  name="Clashes detectados"
                  stroke="var(--primary)"
                  fill="url(#gCreated)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="pendientes"
                  name="Por resolver"
                  stroke="var(--sev-media)"
                  fill="url(#gPending)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="resueltos"
                  name="Resueltos"
                  stroke="var(--sev-baja)"
                  fill="url(#gResolved)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
