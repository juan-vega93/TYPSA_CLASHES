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
import { reconcileSnapshots } from "@/lib/commitment-control";
import { Panel } from "./panel";
export function TimelineTab({
  snapshots,
  include,
  loading = false,
}: {
  clashes: Clash[];
  snapshots: ClashSnapshot[];
  overrides: Record<string, ClashOverride>;
  include?: (clash: Clash) => boolean;
  loading?: boolean;
}) {
  const series = useMemo(
    () => (loading ? [] : reconcileSnapshots(snapshots, include, { details: false })),
    [snapshots, include, loading],
  );
  const last = series.at(-1);
  if (loading)
    return (
      <Panel title="Línea de tiempo">
        <p className="text-sm">Preparando el período seleccionado…</p>
      </Panel>
    );
  return (
    <div className="space-y-4">
      <Panel
        title="Evolución observada por corte"
        subtitle="Estados XML de cada corte. Un resultado ausente o un test retirado no se considera resuelto. Las ediciones locales no reescriben el historial."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Resultados del último corte", last?.total ?? 0],
            ["Pendientes", last?.pending ?? 0],
            ["Resueltos / aprobados presentes", last?.closed ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded border p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{Number(value).toLocaleString("es-PE")}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 h-[380px]">
          <ResponsiveContainer>
            <AreaChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="linear"
                dataKey="total"
                name="Presentes en el corte"
                stroke="#64748b"
                fill="#64748b"
                fillOpacity={0.05}
              />
              <Area
                type="linear"
                dataKey="pending"
                name="Pendientes observados"
                stroke="#d97706"
                fill="#d97706"
                fillOpacity={0.05}
              />
              <Area
                type="linear"
                dataKey="closed"
                name="Resueltos / aprobados presentes"
                stroke="#059669"
                fill="#059669"
                fillOpacity={0.05}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel
        title="Cambios entre cortes"
        subtitle="Para conciliar entradas, reaperturas, cierres y resultados no localizados, utiliza Control de compromisos."
      >
        <div className="overflow-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead>
              <tr className="text-left">
                <th>Corte</th>
                <th>Pendientes</th>
                <th>Nuevos</th>
                <th>Reabiertos</th>
                <th>Cierres XML</th>
                <th>No localizados</th>
                <th>Variación</th>
              </tr>
            </thead>
            <tbody>
              {series.map((row) => (
                <tr key={row.key} className="border-t">
                  <td className="py-2">{row.date || row.label}</td>
                  <td>{row.pending}</td>
                  <td>{row.initial ? "—" : row.counts.new}</td>
                  <td>{row.initial ? "—" : row.counts.reopened}</td>
                  <td>{row.initial ? "—" : row.counts.closed}</td>
                  <td>{row.initial ? "—" : row.counts.missing}</td>
                  <td>{row.initial ? "Base" : row.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
