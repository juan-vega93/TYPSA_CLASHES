import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import type { Clash } from "@/lib/clash-types";
import {
  CLASS_LABELS,
  type CoordinationRules,
  type CoordinationClass,
} from "@/lib/coordination-priority";
import { executiveSummary, percent, segmentation } from "@/lib/executive-summary";
import { useStoredState } from "@/lib/use-stored-state";
import { Panel } from "./panel";
import { Button } from "@/components/ui/button";
const number = (value: number) => value.toLocaleString("es-PE");
const pct = (part: number, total: number) => `${percent(part, total).toFixed(1)}%`;
const CLASSES: CoordinationClass[] = ["C1", "C2", "C3", "C4"];
const COLORS = { C1: "#b91c1c", C2: "#d97706", C3: "#0d9488", C4: "#64748b" };
const dimensions = {
  zona: "Zona",
  nivel: "Nivel principal",
  edificio: "Edificio",
  sector: "Sector",
  contenedor: "Contenedor",
};
type Dimension = keyof typeof dimensions;
const validDimensions = (value: unknown): value is Dimension[] =>
  Array.isArray(value) && value.every((v) => v in dimensions);
export function ResumenTab({
  clashes,
  allCount,
  rules,
  cutDate,
  onConfigure,
}: {
  clashes: Clash[];
  allCount: number;
  rules: CoordinationRules;
  cutDate?: string;
  onConfigure: () => void;
}) {
  const summary = useMemo(() => executiveSummary(clashes, rules), [clashes, rules]);
  const [ranking, setRanking] = useState("priority");
  const [showState, setShowState] = useState(true);
  const [showSeverity, setShowSeverity] = useState(true);
  const rankedTests = useMemo(
    () =>
      ranking === "total"
        ? [...summary.tests].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
        : summary.tests,
    [ranking, summary.tests],
  );
  const stateRows = [
    { name: "Pendientes activos / nuevos", value: summary.statuses.active, color: "#b91c1c" },
    { name: "Revisados pendientes", value: summary.statuses.reviewed, color: "#d97706" },
    { name: "Resueltos", value: summary.statuses.resolved, color: "#389557" },
    { name: "Aprobados", value: summary.statuses.approved, color: "#0d9488" },
  ];
  const severityRows = [
    { name: "Alta", value: summary.severity.alta, color: "#b91c1c" },
    { name: "Media", value: summary.severity.media, color: "#d97706" },
    { name: "Baja", value: summary.severity.baja, color: "#389557" },
  ];
  const pending = useMemo(
    () => clashes.filter((c) => c.status === "active" || c.status === "reviewed"),
    [clashes],
  );
  const optional = useStoredState<Dimension[]>("typsa-executive-charts-v1", [], validDimensions);
  const coverage = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(dimensions) as Dimension[]).map((key) => [key, segmentation(pending, key)]),
      ) as Record<Dimension, ReturnType<typeof segmentation>>,
    [pending],
  );
  const metrics = [
    {
      label: "Avance por estado",
      value: `${summary.progress.toFixed(1)}%`,
      detail: `${number(summary.closed)} de ${number(summary.total)} resueltos / aprobados`,
      color: "text-emerald-700",
    },
    {
      label: "Pendientes del alcance",
      value: number(summary.pending),
      detail: `${pct(summary.pending, summary.total)} del total · nuevos, activos y revisados`,
      color: "text-foreground",
    },
    {
      label: "Prioritarios C1 + C2",
      value: number(summary.priority),
      detail: `${pct(summary.priority, summary.pending)} de los pendientes`,
      color: "text-red-700",
    },
    {
      label: "Candidatos a pases C3",
      value: number(summary.classes.C3),
      detail: `${pct(summary.classes.C3, summary.pending)} de los pendientes · por validar`,
      color: "text-teal-700",
    },
  ];
  return (
    <div className="space-y-4">
      <Panel
        title="Estado ejecutivo de coordinación"
        subtitle={`Corte ${cutDate ?? "actual"} · ${number(summary.total)} de ${number(allCount)} resultados · se respetan los filtros generales`}
        right={
          <Button variant="outline" size="sm" onClick={onConfigure}>
            Configurar prioridades
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className={`my-2 text-3xl font-semibold ${metric.color}`}>{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.detail}</p>
            </div>
          ))}
        </div>
        <div
          className="mt-5 h-3 overflow-hidden rounded-full bg-muted"
          aria-label={`Avance por estado ${summary.progress.toFixed(1)} por ciento`}
        >
          <div className="h-full bg-emerald-600" style={{ width: `${summary.progress}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {number(summary.resolved)} resueltos · {number(summary.approved)} aprobados
          </span>
          <span>{number(summary.pending)} pendientes</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Avance calculado con los estados del alcance actual; no es avance de obra ni el avance
          real manual del plan semanal. Las categorías y la separación de colgadores se toman de
          Matriz de importancia.
        </p>
      </Panel>
      <Panel
        title="¿Qué queda por resolver?"
        subtitle="Distribución exclusiva de los pendientes: C1 + C2 + C3 + C4 = pendiente total. Los porcentajes usan ese mismo denominador."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {CLASSES.map((group) => (
            <div
              key={group}
              className="rounded-xl border border-t-4 p-4"
              style={{ borderTopColor: COLORS[group] }}
            >
              <div className="flex justify-between text-sm font-semibold">
                <span>{group}</span>
                <span>{pct(summary.classes[group], summary.pending)}</span>
              </div>
              <p className="my-2 text-3xl font-semibold">{number(summary.classes[group])}</p>
              <p className="text-xs text-muted-foreground">{CLASS_LABELS[group]}</p>
            </div>
          ))}
        </div>
        <div
          className="mt-4 flex h-5 overflow-hidden rounded-full bg-muted"
          aria-label="Distribución de pendientes C1 a C4"
        >
          {CLASSES.map((group) => (
            <div
              key={group}
              title={`${group}: ${number(summary.classes[group])}`}
              style={{
                width: `${percent(summary.classes[group], summary.pending)}%`,
                background: COLORS[group],
              }}
            />
          ))}
        </div>
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          <div className="rounded-lg bg-muted/30 p-3">
            <strong>
              Avance en categorías prioritarias:{" "}
              {summary.priorityTotal ? `${summary.priorityProgress.toFixed(1)}%` : "Sin resultados"}
            </strong>
            <p className="mt-1 text-xs text-muted-foreground">
              {number(summary.priorityClosed)} de {number(summary.priorityTotal)} resultados C1/C2
              resueltos o aprobados, incluyendo abiertos y cerrados bajo los criterios actuales.
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <strong>Colgadores pendientes: {number(summary.hangers)}</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              {pct(summary.hangers, summary.pending)} de los pendientes.{" "}
              {rules.excludeHangers
                ? "Separados en C4."
                : "La separación está desactivada: pueden formar parte de C1/C2."}{" "}
              C3 es una hipótesis de pase, no un cierre aprobado.
            </p>
          </div>
        </div>
      </Panel>
      <Panel
        title="Dónde concentrar la coordinación"
        subtitle={
          ranking === "total"
            ? "Tests ordenados por total de resultados, abiertos y cerrados. Hasta 8 en la gráfica y 12 en la tabla; los KPI incluyen todos."
            : "Tests ordenados por pendientes prioritarios C1+C2 y luego por pendiente total. Hasta 8 en la gráfica y 12 en la tabla; los KPI incluyen todos."
        }
        right={
          <select
            aria-label="Orden del ranking de tests"
            className="rounded border bg-background p-2 text-sm"
            value={ranking}
            onChange={(event) => setRanking(event.target.value)}
          >
            <option value="priority">Prioritarios pendientes</option>
            <option value="total">Total de clashes</option>
          </select>
        }
      >
        {summary.tests.length ? (
          <>
            <div className="h-[320px]">
              <ResponsiveContainer>
                <BarChart
                  data={rankedTests.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 5, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={125} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  {ranking === "total" ? (
                    <>
                      <Bar dataKey="pending" name="Pendientes" stackId="total" fill="#b91c1c" />
                      <Bar
                        dataKey="closed"
                        name="Resueltos / aprobados"
                        stackId="total"
                        fill="#389557"
                      />
                    </>
                  ) : (
                    CLASSES.map((group) => (
                      <Bar
                        key={group}
                        dataKey={group}
                        name={`${group} pendientes`}
                        stackId="pending"
                        fill={COLORS[group]}
                      />
                    ))
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2">Test</th>
                    <th>Total</th>
                    <th>Avance por estado</th>
                    <th>Pendientes</th>
                    {CLASSES.map((group) => (
                      <th key={group}>{group}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankedTests.slice(0, 12).map((test) => (
                    <tr key={test.name} className="border-b">
                      <td className="p-2">{test.name}</td>
                      <td>{number(test.total)}</td>
                      <td>{pct(test.closed, test.total)}</td>
                      <td className="font-semibold">{number(test.pending)}</td>
                      {CLASSES.map((group) => (
                        <td key={group}>{number(test[group])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay resultados en el alcance seleccionado.
          </p>
        )}
      </Panel>
      <Panel
        title="Segmentaciones opcionales"
        subtitle="Activa las gráficas que necesitas. Se calculan solo sobre pendientes con valor exportado; la cobertura y los faltantes siempre se muestran."
      >
        <div className="flex flex-wrap gap-3">
          {(Object.keys(dimensions) as Dimension[]).map((key) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={optional.value.includes(key)}
                onChange={(event) =>
                  optional.update((values) =>
                    event.target.checked ? [...values, key] : values.filter((v) => v !== key),
                  )
                }
              />
              {dimensions[key]}
              <span className="text-xs text-muted-foreground">
                {pct(coverage[key].covered, summary.pending)} con dato
              </span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Nivel principal cuenta cada clash una vez, usando el nivel del objeto A o, si falta, el
          del B. El filtro general «cualquiera de los dos» puede incluir más de un nivel por clash.
        </p>
        {optional.error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {optional.error}
          </p>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        {optional.value.map((key) => (
          <Panel
            key={key}
            title={`Pendientes por ${dimensions[key].toLowerCase()}`}
            subtitle={`${number(coverage[key].covered)} con dato · ${number(coverage[key].missing)} sin dato · cobertura ${pct(coverage[key].covered, summary.pending)} · hasta 14 valores`}
          >
            {coverage[key].covered ? (
              <div className="h-[340px]">
                <ResponsiveContainer>
                  <BarChart
                    data={coverage[key].rows.slice(0, 14)}
                    layout="vertical"
                    margin={{ right: 20 }}
                  >
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      fontSize={11}
                      tickFormatter={(v) => (v.length > 22 ? `${v.slice(0, 20)}…` : v)}
                    />
                    <Tooltip />
                    <Bar dataKey="value" name="Pendientes" fill="#0d9488" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-sm text-muted-foreground">
                Sin valores exportados para esta segmentación en los pendientes seleccionados.
              </p>
            )}
          </Panel>
        ))}
      </div>
      <Panel
        title="Lecturas complementarias"
        subtitle="Estado detalla activos, revisados, resueltos y aprobados del alcance filtrado. Severidad clasifica únicamente los pendientes por penetración; es distinta de la prioridad C1–C4."
      >
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showState}
              onChange={(event) => setShowState(event.target.checked)}
            />
            Estado detallado
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showSeverity}
              onChange={(event) => setShowSeverity(event.target.checked)}
            />
            Severidad de pendientes
          </label>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {showState && (
            <section className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">
                Estado del corte · {number(summary.total)} resultados
              </h3>
              {summary.total > 0 ? (
                <div className="h-[260px]">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={stateRows.filter((row) => row.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={65}
                        outerRadius={100}
                      >
                        {stateRows
                          .filter((row) => row.value > 0)
                          .map((row) => (
                            <Cell key={row.name} fill={row.color} />
                          ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) =>
                          `${number(value)} · ${pct(value, summary.total)}`
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-8 text-sm text-muted-foreground">Sin resultados en el filtro.</p>
              )}
              <ul className="space-y-2 text-sm">
                {stateRows.map((row) => (
                  <li key={row.name} className="flex items-center justify-between gap-2">
                    <span>
                      <span
                        className="mr-2 inline-block h-3 w-3 rounded-full"
                        style={{ background: row.color }}
                      />
                      {row.name}
                    </span>
                    <strong>
                      {number(row.value)} · {pct(row.value, summary.total)}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {showSeverity && (
            <section className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">
                Severidad · {number(summary.pending)} pendientes
              </h3>
              {summary.pending > 0 ? (
                <div className="h-[260px]">
                  <ResponsiveContainer>
                    <BarChart data={severityRows} margin={{ top: 30, right: 15, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        formatter={(value: number) =>
                          `${number(value)} · ${pct(value, summary.pending)} de los pendientes`
                        }
                      />
                      <Bar dataKey="value" name="Pendientes">
                        {severityRows.map((row) => (
                          <Cell key={row.name} fill={row.color} />
                        ))}
                        <LabelList dataKey="value" position="top" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-8 text-sm text-muted-foreground">
                  No hay pendientes en el filtro.
                </p>
              )}
              <ul className="space-y-2 text-sm">
                {severityRows.map((row) => (
                  <li key={row.name} className="flex justify-between gap-2">
                    <span>
                      <span
                        className="mr-2 inline-block h-3 w-3"
                        style={{ background: row.color }}
                      />
                      {row.name}
                    </span>
                    <strong>
                      {number(row.value)} · {pct(row.value, summary.pending)}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Panel>
    </div>
  );
}
