import { useEffect, useMemo, useRef, useState } from "react";
import type { Clash, ClashSnapshot } from "@/lib/clash-types";
import { compileClashFilter, type FilterState } from "@/lib/clash-query";
import type { ProjectConfig } from "@/lib/project-config";
import { evolutionReportPages, planEvolution, planEvolutionHistory } from "@/lib/plan-evolution";
import { svgPagesPdf } from "@/lib/commitment-export";
import {
  createCoordinationClassifier,
  isPending,
  type CoordinationRules,
} from "@/lib/coordination-priority";
import {
  coordinationSchedule,
  createCoordinationPlan,
  planErrors,
  validPlanList,
  type CoordinationPlan,
  type PlanningRequest,
} from "@/lib/coordination-plan";
import { useStoredState } from "@/lib/use-stored-state";
import { downloadFile, svgGraphPng } from "@/lib/plan-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "./panel";
const number = (value: number) => value.toLocaleString("es-PE");
export function PlanTab({
  clashes,
  allClashes,
  cutDate,
  loading = false,
  rules,
  request,
  filters,
  initialPlanId,
  snapshots,
  config,
  historyLoading,
}: {
  clashes: Clash[];
  allClashes: Clash[];
  cutDate?: string;
  loading?: boolean;
  rules: CoordinationRules;
  request: PlanningRequest | null;
  filters: FilterState;
  initialPlanId?: string;
  snapshots: ClashSnapshot[];
  config: ProjectConfig;
  historyLoading: boolean;
}) {
  const stored = useStoredState<CoordinationPlan[]>(
    "typsa-coordination-plans-v1",
    [],
    validPlanList,
  );
  const [activeId, setActiveId] = useState(initialPlanId ?? ""),
    [source, setSource] = useState("priority"),
    [title, setTitle] = useState("Levantamiento de interferencias prioritarias"),
    [start, setStart] = useState(cutDate ?? "2026-10-27"),
    [end, setEnd] = useState("2026-12-31"),
    [shape, setShape] = useState<"linear" | "s">("linear"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [progressSource, setProgressSource] = useState<"xml" | "manual">("manual");
  const [baseCutKey, setBaseCutKey] = useState("");
  const historicalBase = snapshots.find((snapshot) => snapshot.key === baseCutKey);
  const chosenDate = historicalBase?.date ?? cutDate;
  useEffect(() => {
    if (request) {
      setSource("selection");
      setTitle(request.label);
      setActiveId("new");
    }
  }, [request]);
  const candidates = useMemo(() => {
    const classify = createCoordinationClassifier(rules);
    if (source === "selection") {
      if (baseCutKey) return [];
      const ids = new Set(request?.ids ?? []);
      return allClashes.filter((clash) => ids.has(clash.id) && isPending(clash));
    }
    const matches = compileClashFilter(config, filters);
    const rows = baseCutKey
      ? (historicalBase?.clashes ?? [])
      : source === "cut"
        ? allClashes
        : clashes;
    return rows.filter(
      (clash) =>
        (!baseCutKey || source === "cut" || matches(clash)) &&
        isPending(clash) &&
        (source === "priority"
          ? ["C1", "C2"].includes(classify(clash))
          : source === "passes"
            ? classify(clash) === "C3"
            : true),
    );
  }, [source, request, allClashes, clashes, rules, baseCutKey, historicalBase, config, filters]);
  const active =
    stored.value.find((plan) => plan.id === activeId) ??
    (activeId === "" && !request ? stored.value.at(-1) : undefined);
  const schedule = useMemo(() => (active ? coordinationSchedule(active) : []), [active]);
  const baseIds = active?.baseIds,
    baseKeys = active?.baseKeys,
    baseRules = active?.rules,
    baseDate = active?.cutDate,
    baseFilters = active?.filters;
  const evolutionHistory = useMemo(() => {
    if (
      !baseIds ||
      !baseRules ||
      !baseDate ||
      baseFilters === undefined ||
      historyLoading ||
      !snapshots.length
    )
      return undefined;
    try {
      return {
        rows: planEvolutionHistory(
          { baseIds, baseKeys, rules: baseRules, cutDate: baseDate, filters: baseFilters },
          snapshots,
          config,
        ),
        error: "",
      };
    } catch (reason) {
      return {
        error: reason instanceof Error ? reason.message : "No se pudo comparar el alcance.",
      };
    }
  }, [baseIds, baseKeys, baseRules, baseDate, baseFilters, snapshots, config, historyLoading]);
  const evolution = useMemo(() => {
    if (!active || !evolutionHistory) return undefined;
    if (!evolutionHistory.rows) return { error: evolutionHistory.error };
    return {
      ...planEvolution(active, snapshots, config, progressSource, evolutionHistory.rows),
      error: "",
    };
  }, [active, snapshots, config, progressSource, evolutionHistory]);
  const errors = active ? planErrors(active) : [];
  const patch = (change: (plan: CoordinationPlan) => CoordinationPlan) => {
    if (active)
      stored.update((plans) => plans.map((plan) => (plan.id === active.id ? change(plan) : plan)));
  };
  function create() {
    try {
      const plan = createCoordinationPlan(
        candidates,
        title,
        chosenDate ?? start,
        rules,
        JSON.stringify({
          source,
          filters,
          requestLabel: source === "selection" ? request?.label : undefined,
        }),
        start,
        end,
        shape,
      );
      stored.update((plans) => [...plans, plan]);
      setActiveId(plan.id);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear la línea base");
    }
  }
  async function exportEvolution(kind: "png" | "pdf") {
    if (!active || !evolution || evolution.error || !("svg" in evolution)) return;
    setBusy(true);
    setError("");
    try {
      if (errors.length) throw Error(errors.join(" "));
      const data =
        kind === "png"
          ? await svgGraphPng(evolution.svg!)
          : await svgPagesPdf(
              evolutionReportPages(active, evolution as ReturnType<typeof planEvolution>),
            );
      downloadFile(
        `evolucion-${active.cutDate}-${evolution.latest!.date}.${kind}`,
        data,
        kind === "png" ? "image/png" : "application/pdf",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo exportar la evolución.");
    } finally {
      setBusy(false);
    }
  }
  function exportCsv() {
    if (!active) return;
    const cell = (value: unknown) =>
      `"${String(value ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows: unknown[][] = [
      [
        "Línea base",
        "Corte",
        "Base inicial",
        "C1",
        "C2",
        "C3",
        "C4",
        "Control",
        "Meta período",
        "Planeado acumulado",
        "Real acumulado manual",
        "Desviación",
        "Reglas",
        "Alcance",
      ],
      ...schedule.map((row) => [
        active.title,
        active.cutDate,
        active.baseCount,
        active.summary.C1,
        active.summary.C2,
        active.summary.C3,
        active.summary.C4,
        row.date,
        row.weekly,
        row.cumulative,
        row.actual ?? "",
        row.deviation ?? "",
        JSON.stringify(active.rules),
        active.filters,
      ]),
    ];
    downloadFile(
      `plan-${active.startDate}-${active.endDate}.csv`,
      "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  async function restore(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (data.schema !== "coordination-plans-v1" || !validPlanList(data.plans))
        throw Error("El respaldo de planes no es válido");
      stored.update((plans) => [
        ...new Map(
          [...plans, ...data.plans].map((plan: CoordinationPlan) => [plan.id, plan]),
        ).values(),
      ]);
      setActiveId(data.plans.at(-1)?.id ?? "new");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo recuperar el respaldo");
    }
  }
  if (loading || !stored.ready)
    return (
      <Panel title="Plan de resolución">
        <p>Preparando datos y planes guardados…</p>
      </Panel>
    );
  return (
    <div className="space-y-4">
      <Panel
        title="Planificar el alcance seleccionado"
        subtitle={`Corte ${chosenDate ?? "actual"} · ${number(candidates.length)} pendientes propuestos. La fecha de referencia determina los datos de la base.`}
      >
        <label className="mb-4 grid gap-1 text-sm">
          Corte que será la línea base
          <select
            className="max-w-lg rounded border bg-background p-2"
            value={baseCutKey}
            onChange={(e) => {
              const key = e.target.value;
              setBaseCutKey(key);
              const date = snapshots.find((snapshot) => snapshot.key === key)?.date ?? cutDate;
              if (date) setStart(date);
              setActiveId("new");
            }}
          >
            <option value="">Corte actual · {cutDate}</option>
            {snapshots.map((snapshot) => (
              <option key={snapshot.key} value={snapshot.key}>
                {snapshot.date} · {snapshot.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Para elegir el 19/10, genera arriba un período que lo incluya. Selecciona después el
            alcance C1+C2 o todos los pendientes y guarda una nueva base; los planes anteriores se
            conservan.
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm">
            Alcance
            <select
              className="rounded border bg-background p-2"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="priority">Prioritarios C1 + C2 con filtros</option>
              <option value="passes">Candidatos C3 con filtros</option>
              <option value="filtered">Todos los pendientes filtrados</option>
              <option value="cut">Todos los pendientes del corte</option>
              {request && <option value="selection">Selección enviada desde la matriz</option>}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Inicio
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Fecha objetivo
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Distribución inicial
            <select
              className="rounded border bg-background p-2"
              value={shape}
              onChange={(e) => setShape(e.target.value as "linear" | "s")}
            >
              <option value="linear">Uniforme</option>
              <option value="s">Curva S</option>
            </select>
          </label>
        </div>
        <label className="mt-4 grid gap-1 text-sm">
          Nombre de la línea base
          <Input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={create}
            disabled={!candidates.length || historyLoading || (!!baseCutKey && !historicalBase)}
          >
            Crear y guardar línea base · {number(candidates.length)}
          </Button>
          <Button variant="outline" onClick={() => setActiveId("new")}>
            Preparar otro plan
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Al crear una línea base se guardan sus GUID, categorías, filtros y fecha de corte. No se
          recalcula sobre nuevos XML ni cambia al editar los filtros. Las metas semanales se pueden
          ajustar; el avance real solo se registra a mano. El plan queda guardado en este navegador
          y en esta dirección del dashboard; cargar otro XML o generar otro período no lo borra. No
          se guarda como archivo en una carpeta ni se sincroniza con otros equipos. Descarga
          «Respaldar planes JSON» para conservarlo si cambias de navegador, dirección o equipo, o
          borras los datos del sitio.
        </p>
      </Panel>
      {(error || stored.error) && (
        <p
          role="alert"
          className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm"
        >
          {error || stored.error}
        </p>
      )}
      <Panel title="Planes guardados">
        <p className="mb-3 text-sm text-muted-foreground">
          El avance real es el número acumulado de cierres verificados de los clashes incluidos en
          esta base desde su fecha inicial. Al iniciar una base nueva, registra 0; no arrastres
          cierres anteriores. Usa un corte de la misma fecha que el control semanal para registrar
          el dato. Los clashes nuevos se reflejan en el inventario y la proyección de Control de
          compromisos; no cambian automáticamente esta base ni su avance.
        </p>
        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Línea base guardada"
            className="max-w-full rounded border bg-background p-2 text-sm"
            value={active?.id ?? "new"}
            onChange={(e) => setActiveId(e.target.value)}
          >
            <option value="new">Selecciona una línea base</option>
            {stored.value.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.title} · {plan.baseCount} · {plan.cutDate}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={!stored.value.length}
            onClick={() =>
              downloadFile(
                "respaldo-planes.json",
                JSON.stringify({ schema: "coordination-plans-v1", plans: stored.value }, null, 2),
                "application/json",
              )
            }
          >
            Respaldar planes JSON
          </Button>
          <Button variant="outline" onClick={() => input.current?.click()}>
            Recuperar respaldo
          </Button>
          <input
            className="hidden"
            type="file"
            accept=".json"
            ref={input}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void restore(file);
              e.target.value = "";
            }}
          />
        </div>
      </Panel>
      {active && (
        <>
          <Panel
            title="Curva original y carga actualizada"
            subtitle={`Base fija del ${active.cutDate}: ${number(active.baseCount)} clashes. Gris: plan original · naranja: carga actualizada · verde: avance de la fuente elegida.`}
          >
            {historyLoading ? (
              <p>Calculando el período seleccionado…</p>
            ) : evolution && !evolution.error && "svg" in evolution ? (
              <>
                <label className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                  Línea verde: avance mostrado
                  <select
                    className="rounded border bg-background p-2"
                    value={progressSource}
                    onChange={(e) => setProgressSource(e.target.value as "manual" | "xml")}
                  >
                    <option value="manual">Avance manual de la base</option>
                    <option value="xml">Cierres acumulados según XML</option>
                  </select>
                </label>
                {progressSource === "manual" && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    Introduce los acumulados en la tabla inferior. Una celda vacía no dibuja un
                    punto; 0 sí se muestra. Los cierres XML del balance son una referencia
                    independiente y no se copian al avance manual.
                  </p>
                )}
                <div className="overflow-auto">
                  <div
                    className="min-w-[800px]"
                    dangerouslySetInnerHTML={{ __html: evolution.svg! }}
                  />
                </div>
                <p className="my-3 text-sm">
                  Al {evolution.latest!.date}: la carga pasó de{" "}
                  <strong>{number(active.baseCount)}</strong> a{" "}
                  <strong>{number(evolution.workload!)}</strong>. Se cerraron{" "}
                  <strong>{number(evolution.latest!.closed)}</strong> y quedan{" "}
                  <strong>{number(evolution.latest!.pending)}</strong> pendientes.
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  La curva naranja sube al incorporar entradas y baja por otras salidas. Continúa la
                  forma del plan original con la carga conocida hasta el último corte; no promete
                  que esa carga adicional se cierre en la misma fecha. Los valores que registres en
                  la tabla de abajo se dibujan al elegir «Avance manual».
                </p>
                <details>
                  <summary className="cursor-pointer text-sm">
                    Ver detalle de entradas, cierres y otras salidas
                  </summary>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          {[
                            "Corte",
                            "Base inicial",
                            "Cierres acumulados XML",
                            "Entradas acumuladas",
                            "Otras salidas",
                            "Pendiente real",
                          ].map((label) => (
                            <th key={label} className="p-2 text-left">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {evolution.rows!.map((row) => (
                          <tr key={row.date} className="border-t">
                            {[
                              row.date,
                              active.baseCount,
                              row.closed,
                              row.entries,
                              row.exits,
                              row.pending,
                            ].map((value, i) => (
                              <td key={i} className="p-2">
                                {typeof value === "number" ? number(value) : value}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() =>
                    downloadFile("evolucion-linea-base.svg", evolution.svg!, "image/svg+xml")
                  }
                >
                  Exportar comparación SVG
                </Button>
                <Button
                  className="ml-2 mt-3"
                  variant="outline"
                  disabled={busy || !!errors.length}
                  onClick={() => void exportEvolution("png")}
                >
                  Gráfico PNG
                </Button>
                <Button
                  className="ml-2 mt-3"
                  disabled={busy || !!errors.length}
                  onClick={() => void exportEvolution("pdf")}
                >
                  {busy ? "Preparando…" : "Reporte PDF · evolución"}
                </Button>
              </>
            ) : (
              <p className="text-sm">
                {evolution?.error ||
                  "Selecciona arriba un período que incluya el corte de la base y los cortes posteriores, y pulsa Generar período."}
              </p>
            )}
          </Panel>
          <Panel
            right={
              <Button variant="outline" disabled={busy || errors.length > 0} onClick={exportCsv}>
                Exportar metas y avance CSV
              </Button>
            }
            title="Metas semanales y avance real"
            subtitle="Introduce cierres acumulados verificados de la base. La curva superior se actualiza al elegir Avance manual; una celda vacía significa sin registro."
          >
            {errors.length > 0 && (
              <div
                role="alert"
                className="mb-3 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm"
              >
                {errors.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            )}
            <div className="overflow-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2">Control</th>
                    <th>Meta período</th>
                    <th>Planeado acumulado</th>
                    <th>Avance real acumulado</th>
                    <th>Desviación</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row, index) => (
                    <tr key={row.date} className="border-b">
                      <td className="p-2">{row.date}</td>
                      <td>
                        <Input
                          aria-label={`Meta ${row.date}`}
                          className="my-1 w-28"
                          type="number"
                          step={1}
                          min={0}
                          disabled={index === 0}
                          value={row.weekly}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            if (Number.isInteger(value) && value >= 0)
                              patch((plan) => ({
                                ...plan,
                                goals: { ...plan.goals, [row.date]: value },
                              }));
                          }}
                        />
                      </td>
                      <td>{number(row.cumulative)}</td>
                      <td>
                        <Input
                          aria-label={`Avance real ${row.date}`}
                          className="my-1 w-36"
                          placeholder="Sin registrar"
                          type="number"
                          min={0}
                          max={active.baseCount}
                          step={1}
                          value={row.actual ?? ""}
                          onChange={(e) => {
                            const text = e.target.value,
                              value = Number(text);
                            if (text !== "" && (!Number.isInteger(value) || value < 0)) return;
                            setProgressSource("manual");
                            patch((plan) => {
                              const actuals = { ...plan.actuals };
                              if (text === "") delete actuals[row.date];
                              else actuals[row.date] = value;
                              return { ...plan, actuals };
                            });
                          }}
                        />
                      </td>
                      <td>{row.deviation === null ? "—" : number(row.deviation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Las metas deben sumar la base guardada. Los avances deben ser acumulados, no
              decrecientes y menores o iguales a esa base. Un cambio de alcance requiere otra línea
              base para conservar el historial.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
