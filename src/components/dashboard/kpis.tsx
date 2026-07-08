import { memo } from "react";
import { Layers, Clock, CheckCircle2, AlertTriangle, Ruler, Boxes } from "lucide-react";
import type { ClashMetrics } from "@/lib/clash-query";

function Card({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]">
      <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-primary/70" />
      </div>
      <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
      <div className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-500 group-hover:scale-x-100" />
    </div>
  );
}

export const KpiCards = memo(function KpiCards({
  allCount,
  metrics,
}: {
  allCount: number;
  metrics: ClashMetrics;
}) {
  const pct = (n: number) =>
    metrics.total === 0 ? "0%" : `${Math.round((n / metrics.total) * 100)}%`;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      <Card label="Total Clashes" value={String(metrics.total)} hint={`${allCount} sin filtros`} icon={Layers} />
      <Card label="Pendientes" value={String(metrics.pending)} hint={`${pct(metrics.pending)} del filtrado`} icon={Clock} />
      <Card label="Resueltos / Aprob." value={String(metrics.resolved)} hint={`${pct(metrics.resolved)} del filtrado`} icon={CheckCircle2} />
      <Card label="Severidad Alta" value={String(metrics.alta)} hint="Penetracion >= 0.10 m" icon={AlertTriangle} />
      <Card label="Penetracion prom." value={`${metrics.avgPen.toFixed(3)} m`} hint="|valor absoluto|" icon={Ruler} />
      <Card label="Element IDs reales" value={String(metrics.withElementId)} hint="Identificables en Revit" icon={Boxes} />
    </div>
  );
});
