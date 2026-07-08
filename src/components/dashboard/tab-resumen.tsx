import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Clash } from "@/lib/clash-types";
import { Panel } from "./panel";

const SEV_COLORS: Record<string, string> = {
  alta: "var(--sev-alta)",
  media: "var(--sev-media)",
  baja: "var(--sev-baja)",
};

const STATUS_COLORS: Record<string, string> = {
  active: "var(--primary)",
  reviewed: "var(--chart-3)",
  approved: "var(--chart-4)",
  resolved: "var(--sev-baja)",
};

function group<T>(items: T[], keyFn: (t: T) => string | undefined) {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = keyFn(it) ?? "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function ResumenTab({ clashes }: { clashes: Clash[] }) {
  const byZona = useMemo(() => group(clashes, (c) => c.zona).slice(0, 14), [clashes]);
  const byStatus = useMemo(() => group(clashes, (c) => c.status), [clashes]);
  const bySeverity = useMemo(() => group(clashes, (c) => c.severity), [clashes]);
  const byTest = useMemo(() => group(clashes, (c) => c.test).slice(0, 8), [clashes]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="Clashes por Zona" className="lg:col-span-2">
        <div className="h-[340px]">
          <ResponsiveContainer>
            <BarChart data={byZona} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickFormatter={(v) => (v.length > 22 ? v.slice(0, 20) + "…" : v)}
              />
              <Tooltip cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Estado">
        <div className="h-[340px]">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={byStatus}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
              >
                {byStatus.map((s) => (
                  <Cell key={s.name} fill={STATUS_COLORS[s.name] ?? "var(--muted-foreground)"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Severidad">
        <div className="h-[280px]">
          <ResponsiveContainer>
            <BarChart data={bySeverity}>
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {bySeverity.map((s) => (
                  <Cell key={s.name} fill={SEV_COLORS[s.name] ?? "var(--muted-foreground)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Top Tests" className="lg:col-span-2">
        <div className="h-[280px]">
          <ResponsiveContainer>
            <BarChart data={byTest}>
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => (v.length > 12 ? v.slice(0, 10) + "…" : v)} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="value" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}