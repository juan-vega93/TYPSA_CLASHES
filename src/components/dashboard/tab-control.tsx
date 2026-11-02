import { useMemo, useRef, useState } from "react";
import type { Clash, ClashSnapshot } from "@/lib/clash-types";
import { compileClashFilter, type FilterState } from "@/lib/clash-query";
import type { ProjectConfig } from "@/lib/project-config";
import {
  createCoordinationClassifier,
  type CoordinationClass,
  type CoordinationRules,
} from "@/lib/coordination-priority";
import {
  validPlanList,
  planErrors,
  createCoordinationPlan,
  coordinationSchedule,
  type CoordinationPlan,
} from "@/lib/coordination-plan";
import {
  baselineMembership,
  clashIdentity,
  forecastPoints,
  periodNarrative,
  MOVEMENT_LABELS,
  reconcileSnapshots,
  validForecasts,
  type ForecastVersion,
  type MovementKind,
} from "@/lib/commitment-control";
import {
  commitmentGraphs,
  controlCsv,
  controlPdf,
  CONTROL_GRAPH_LABELS,
  type ControlReport,
} from "@/lib/commitment-export";
import { useStoredState } from "@/lib/use-stored-state";
import { breakdownSvg, commitmentBreakdown, testSpecialties } from "@/lib/commitment-breakdown";
import { movementTotals } from "@/lib/commitment-control";
import { downloadFile } from "@/lib/plan-export";
import { Panel } from "./panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const CLASSES: CoordinationClass[] = ["C1", "C2", "C3", "C4"];
const number = (v: number) => v.toLocaleString("es-PE");
function storedFilters(plan: CoordinationPlan | undefined): FilterState {
  try {
    const parsed = JSON.parse(plan?.filters ?? "{}");
    if (parsed.source === "cut") return {};
    const filters = parsed.filters;
    const result: FilterState = {};
    if (!filters || typeof filters !== "object" || Array.isArray(filters)) return result;
    for (const [key, value] of Object.entries(filters)) {
      if (key === "nivelSource") {
        if (["primary", "a", "b", "either"].includes(String(value)))
          result.nivelSource = value as FilterState["nivelSource"];
      } else if (key === "search") {
        if (typeof value === "string") result.search = value;
      } else if (
        typeof value === "string" ||
        (Array.isArray(value) && value.every((v) => typeof v === "string"))
      )
        result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}
export function ControlTab({
  snapshots,
  config,
  rules,
  loading,
  dataErrors = 0,
  onPlan,
}: {
  snapshots: ClashSnapshot[];
  config: ProjectConfig;
  rules: CoordinationRules;
  loading: boolean;
  dataErrors?: number;
  onPlan: (planId?: string) => void;
}) {
  const stored = useStoredState<CoordinationPlan[]>(
    "typsa-coordination-plans-v1",
    [],
    validPlanList,
  );
  const versions = useStoredState<ForecastVersion[]>(
    "typsa-control-forecasts-v1",
    [],
    validForecasts,
  );
  const [planId, setPlanId] = useState("none"),
    [cutKey, setCutKey] = useState(""),
    [classes, setClasses] = useState<CoordinationClass[]>(CLASSES),
    [tests, setTests] = useState<string[] | null>(null),
    [capacity, setCapacity] = useState(""),
    [arrivals, setArrivals] = useState(""),
    [versionId, setVersionId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [newBaseCut, setNewBaseCut] = useState("");
  const [newBaseEnd, setNewBaseEnd] = useState("2026-12-31");
  const [includeAppendix, setIncludeAppendix] = useState(false);
  const [specialty, setSpecialty] = useState("");
  const [breakdownMode, setBreakdownMode] = useState<"pair" | "test">("pair");
  const restoreInput = useRef<HTMLInputElement>(null);
  const plan =
    planId === "none"
      ? undefined
      : (stored.value.find((p) => p.id === planId) ?? stored.value.at(-1));
  const fixedRules = plan?.rules ?? rules;
  const filters = useMemo(() => storedFilters(plan), [plan]);
  const base = useMemo(
    () =>
      snapshots
        .filter((s) => s.date === plan?.cutDate)
        .sort((a, b) => {
          const ids = new Set(plan?.baseKeys ?? plan?.baseIds ?? []);
          const count = (s: ClashSnapshot) =>
            s.clashes.filter((c) => ids.has(plan?.baseKeys ? clashIdentity(c) : c.id)).length;
          return count(b) - count(a);
        })[0],
    [snapshots, plan],
  );
  const baseTests = useMemo(() => {
    if (plan?.baseKeys) return new Set(plan.baseKeys.map((key) => String(JSON.parse(key)[0])));
    const ids = new Set(plan?.baseIds ?? []);
    return new Set((base?.clashes ?? []).filter((c) => ids.has(c.id)).map((c) => c.test));
  }, [base, plan]);
  const testOptions = useMemo(
    () => [...new Set(snapshots.flatMap((s) => s.clashes.map((c) => c.test)))].sort(),
    [snapshots],
  );
  const specialtyOptions = useMemo(
    () => [...new Set(testOptions.flatMap(testSpecialties))].sort(),
    [testOptions],
  );
  const effectiveTests = useMemo(
    () =>
      (tests ?? testOptions).filter(
        (test) => !specialty || testSpecialties(test).includes(specialty),
      ),
    [tests, testOptions, specialty],
  );
  const selectedTestSet = useMemo(() => new Set(effectiveTests), [effectiveTests]);
  const include = useMemo(() => {
    const matches = compileClashFilter(config, filters);
    const classify = createCoordinationClassifier(fixedRules);
    const result = new WeakMap<Clash, boolean>();
    return (clash: Clash) => {
      const cached = result.get(clash);
      if (cached !== undefined) return cached;
      const selected =
        selectedTestSet.has(clash.test) && matches(clash) && classes.includes(classify(clash));
      result.set(clash, selected);
      return selected;
    };
  }, [config, filters, selectedTestSet, classes, fixedRules]);
  const balances = useMemo(
    () => reconcileSnapshots(snapshots, include, { details: false }),
    [snapshots, include],
  );
  const cuts = balances;
  const selected = cuts.find((c) => c.key === cutKey) ?? cuts.at(-1);
  const breakdown = useMemo(
    () => (selected ? commitmentBreakdown(selected, breakdownMode) : []),
    [selected, breakdownMode],
  );
  const breakdownGraph = useMemo(() => breakdownSvg(breakdown), [breakdown]);
  const movements = selected ? movementTotals(selected) : undefined;
  const movementDetails = selected
    ? Object.entries(selected.counts).filter(([kind, value]) => kind !== "closed" && value > 0)
    : [];
  const current = snapshots.find((s) => s.key === selected?.key);
  const membership = useMemo(
    () => (plan ? baselineMembership(plan.baseIds, plan.baseKeys, base, current) : undefined),
    [plan, base, current],
  );
  const inventoryMatchesBase = useMemo(() => {
    if (!plan || !base || !membership || membership.unmatched) return false;
    const observedBase = new Set(
      base.clashes
        .filter((c) => include(c) && (c.status === "active" || c.status === "reviewed"))
        .map(clashIdentity),
    );
    return (
      observedBase.size === plan.baseCount && membership.keys.every((key) => observedBase.has(key))
    );
  }, [plan, base, membership, include]);
  const scope = JSON.stringify({
    tests: [...effectiveTests].sort(),
    classes: [...classes].sort(),
    filters,
    rules: fixedRules,
  });
  const applicable = versions.value.filter(
    (v) =>
      v.planId === (plan?.id ?? "none") &&
      v.cutKey === selected?.key &&
      v.cutDate === selected?.date &&
      v.scope === scope &&
      v.pending === selected.pending,
  );
  const forecast = applicable.find((v) => v.id === versionId) ?? applicable.at(-1);
  const forecastResult = forecast ? forecastPoints(forecast) : undefined;
  const lastManual = plan
    ? coordinationSchedule(plan)
        .filter((row) => row.actual !== null && row.date <= (selected?.date ?? ""))
        .at(-1)
    : undefined;
  const due = plan
    ? coordinationSchedule(plan)
        .filter((row) => row.date <= (selected?.date ?? ""))
        .at(-1)
    : undefined;
  const notes = [
    `Clases: ${classes.join(", ") || "ninguna"} · ${effectiveTests.length} tests seleccionados. Criterios ${plan ? "guardados con la línea base" : "actuales"}.`,
    "Comparación por test + GUID; resultados ausentes no se acreditan como resueltos.",
    "Las entradas y reapariciones se identifican dentro del período seleccionado, sin analizar carpetas fuera de ese intervalo.",
    "Los tests incorporados se cuentan como cobertura, no como nuevas interferencias de diseño.",
    "Una nueva detección no prueba por sí sola que haya sido causada por diseño.",
    "Las fechas son cortes de observación, no fechas exactas de ejecución ni de cierre.",
    ...(dataErrors
      ? [
          `${dataErrors} archivos XML no se pudieron cargar: el alcance observado puede estar incompleto.`,
        ]
      : []),
    ...(plan && !inventoryMatchesBase
      ? [
          "El alcance observado no coincide con la base inicial: se omite el pendiente planeado de esa gráfica para evitar comparar denominadores distintos.",
        ]
      : []),
    ...(plan && !base
      ? [
          "El corte original no está en el período seleccionado. Amplía el inicio para vincular una base antigua si es necesario.",
        ]
      : []),
    ...(membership?.unmatched
      ? [
          `${membership.unmatched} resultados de la base no se pudieron vincular de forma inequívoca.`,
        ]
      : []),
    ...(plan && planErrors(plan).length
      ? ["La línea base tiene metas o avances manuales pendientes de corrección."]
      : []),
  ];
  const report: ControlReport | undefined = selected
    ? {
        title: "Control de compromisos",
        plan,
        cuts: cuts.filter(
          (c) =>
            c.date <= selected.date &&
            (c.date !== selected.date || balances.indexOf(c) <= balances.indexOf(selected)),
        ),
        selected,
        scope: `${classes.join(" + ") || "Sin clases"} · ${specialty || "Todas las especialidades"} · ${effectiveTests.length} tests · criterios ${plan ? "guardados con la base" : "actuales"}`,
        breakdown,
        scopeDetails: scope,
        forecast,
        notes,
        membership,
        compareInventoryPlan: inventoryMatchesBase,
        includeAppendix,
        warnings: [
          ...(dataErrors
            ? [
                `${dataErrors} archivos XML no se pudieron cargar: el reporte puede estar incompleto.`,
              ]
            : []),
          ...(membership?.unmatched
            ? [
                `${membership.unmatched} resultados de la base no se pudieron vincular de forma inequívoca.`,
              ]
            : []),
        ],
      }
    : undefined;
  const graphs = report ? commitmentGraphs(report) : undefined;
  async function pdf() {
    if (!report) return;
    setBusy(true);
    setError("");
    try {
      downloadFile(
        `control-compromisos-${selected!.date}.pdf`,
        await controlPdf(report),
        "application/pdf",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo exportar");
    } finally {
      setBusy(false);
    }
  }
  function saveForecast() {
    const closures = Number(capacity),
      entries = Number(arrivals);
    if (
      !selected ||
      capacity === "" ||
      arrivals === "" ||
      ![closures, entries].every((v) => Number.isSafeInteger(v) && v >= 0)
    ) {
      setError("Introduce cierres y entradas semanales como enteros no negativos.");
      return;
    }
    const version: ForecastVersion = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      planId: plan?.id ?? "none",
      cutKey: selected.key,
      cutDate: selected.date,
      pending: selected.pending,
      closuresPerWeek: closures,
      arrivalsPerWeek: entries,
      scope,
    };
    versions.update((values) => [...values, version]);
    setVersionId(version.id);
    setError("");
  }
  function createHistoricalBase() {
    const snapshot = snapshots.find((s) => s.key === newBaseCut) ?? snapshots.at(-1);
    if (!snapshot) return;
    try {
      const rows = snapshot.clashes.filter(
        (c) => include(c) && (c.status === "active" || c.status === "reviewed"),
      );
      const next = createCoordinationPlan(
        rows,
        `Compromiso ${snapshot.date} · ${classes.join(" + ")}`,
        snapshot.date,
        fixedRules,
        JSON.stringify({
          source: "filtered",
          filters,
          classes,
          requestLabel: "Base desde corte histórico",
        }),
        snapshot.date,
        newBaseEnd,
        "s",
      );
      stored.update((plans) => [...plans, next]);
      setPlanId(next.id);
      setCutKey("");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la base histórica");
    }
  }
  async function restoreForecasts(file: File | undefined) {
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!validForecasts(data)) throw Error("El archivo no contiene proyecciones válidas.");
      versions.update((current) => [
        ...new Map([...current, ...data].map((version) => [version.id, version])).values(),
      ]);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo restaurar el respaldo.");
    } finally {
      if (restoreInput.current) restoreInput.current.value = "";
    }
  }
  if (loading || !stored.ready || !versions.ready)
    return (
      <Panel title="Control de compromisos">
        <p>Preparando cortes históricos y líneas base…</p>
      </Panel>
    );
  return (
    <div className="space-y-4">
      <Panel
        title="Control de compromisos"
        subtitle="Compara el compromiso original con el pendiente observado y explica cada cambio de alcance. Los filtros generales superiores no modifican este reporte: usa el alcance de esta pestaña."
        right={
          <Button variant="outline" size="sm" onClick={() => onPlan(plan?.id)}>
            Abrir plan semanal
          </Button>
        }
      >
        <div className="flex flex-wrap gap-4">
          <label className="grid gap-1 text-sm">
            Especialidad participante
            <select
              className="rounded border bg-background p-2"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            >
              <option value="">Todas las especialidades</option>
              {specialtyOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Línea base
            <select
              className="max-w-sm rounded border bg-background p-2"
              value={plan?.id ?? "none"}
              onChange={(e) => {
                setPlanId(e.target.value);
                setCutKey("");
                setTests(null);
                setVersionId("");
              }}
            >
              <option value="none">Sin línea base · solo control de cortes</option>
              {stored.value.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {p.cutDate} · {number(p.baseCount)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Corte de evaluación
            <select
              className="rounded border bg-background p-2"
              value={selected?.key ?? ""}
              onChange={(e) => {
                setCutKey(e.target.value);
              }}
            >
              {cuts.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.date} · {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <details className="mt-3 rounded border p-3">
          <summary className="cursor-pointer text-sm">
            Crear compromiso desde un corte histórico
          </summary>
          <p className="my-3 text-xs text-muted-foreground">
            Guarda los pendientes de ese corte con los tests, clases y criterios seleccionados en
            esta pestaña. No reemplaza planes anteriores. Las metas y el avance manual se editan
            después en Plan de resolución.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">
              Corte inicial
              <select
                className="rounded border bg-background p-2"
                value={newBaseCut || snapshots.at(-1)?.key || ""}
                onChange={(e) => setNewBaseCut(e.target.value)}
              >
                {snapshots.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.date} · {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Fin del compromiso
              <Input
                type="date"
                value={newBaseEnd}
                onChange={(e) => setNewBaseEnd(e.target.value)}
              />
            </label>
            <Button variant="outline" onClick={createHistoricalBase}>
              Guardar línea base histórica
            </Button>
          </div>
        </details>
        <div className="mt-4 flex flex-wrap gap-3">
          {CLASSES.map((c) => (
            <label key={c} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={classes.includes(c)}
                onChange={(e) => {
                  setClasses((values) =>
                    e.target.checked ? [...values, c] : values.filter((v) => v !== c),
                  );
                }}
              />
              {c}
            </label>
          ))}
          <Button variant="outline" size="sm" onClick={() => setClasses(["C1", "C2"])}>
            Solo C1 + C2
          </Button>
          <Button variant="outline" size="sm" onClick={() => setClasses(CLASSES)}>
            Todas las clases
          </Button>
        </div>
        <details className="mt-3 rounded border p-3">
          <summary className="cursor-pointer text-sm">
            Tests incluidos · {effectiveTests.length} de {testOptions.length}
          </summary>
          <div className="my-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setTests(null)}>
              Todos, incluidos tests nuevos
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!baseTests.size}
              onClick={() => setTests([...baseTests])}
            >
              Solo tests de la base
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTests([])}>
              Ninguno
            </Button>
          </div>
          <div className="grid max-h-52 gap-2 overflow-auto sm:grid-cols-3">
            {testOptions.map((test) => (
              <label key={test} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedTestSet.has(test)}
                  onChange={(e) =>
                    setTests(
                      e.target.checked
                        ? [...effectiveTests, test]
                        : effectiveTests.filter((t) => t !== test),
                    )
                  }
                />
                {test}
              </label>
            ))}
          </div>
        </details>
        {plan && (
          <p className="mt-3 text-xs text-muted-foreground">
            El compromiso y el avance manual conservan el alcance original de{" "}
            {number(plan.baseCount)} resultados. El pendiente observado usa los tests y clases de
            esta pestaña y los filtros generales guardados con el plan; puede tener un alcance
            mayor. Los pares o selecciones puntuales de la matriz quedan identificados en la base
            original, no se extrapolan a nuevas detecciones.
          </p>
        )}
      </Panel>
      {(error || stored.error || versions.error) && (
        <p
          role="alert"
          className="rounded border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error || stored.error || versions.error}
        </p>
      )}
      {!selected || !report || !graphs ? (
        <Panel title="Sin cortes disponibles">
          <p className="text-sm">
            Carga cortes XML para comenzar. Si la base es posterior a todos los cortes, selecciona
            otra base.
          </p>
        </Panel>
      ) : (
        <>
          <Panel
            title="Balance del período"
            subtitle={`${selected.fromDate ?? selected.date} → ${selected.date} · ${specialty || "Todas las especialidades"} · ${classes.join(" + ")}`}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  "Al inicio",
                  number(selected.opening),
                  "Pendientes en el corte anterior",
                  "border-slate-400",
                ],
                [
                  "Se cerraron",
                  selected.initial ? "—" : number(selected.counts.closed),
                  "Ahora resueltos / aprobados en XML",
                  "border-emerald-600",
                ],
                [
                  "Entraron",
                  selected.initial ? "—" : number(movements!.entries),
                  "Nuevos y otras entradas al alcance",
                  "border-amber-600",
                ],
                [
                  "Quedan por cerrar",
                  number(selected.pending),
                  "Pendientes al corte final",
                  "border-red-700",
                ],
              ].map(([label, value, hint, color]) => (
                <div key={label} className={`rounded-lg border border-t-4 p-4 ${color}`}>
                  <p className="text-sm">{label}</p>
                  <p className="my-2 text-3xl font-semibold">{value}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm">
              {selected.initial
                ? "Primer corte: todavía no hay comparación."
                : `${number(selected.opening)} iniciales + ${number(movements!.entries)} entradas − ${number(selected.counts.closed)} cierres − ${number(movements!.otherExits)} otras salidas = ${number(selected.pending)} pendientes. Cambio neto: ${selected.delta > 0 ? "+" : ""}${number(selected.delta)}.`}
            </p>
            {!!movements!.otherExits && (
              <p className="mt-2 text-xs text-muted-foreground">
                Las otras salidas son retirados o no localizados; no se acreditan como resueltos.
              </p>
            )}
          </Panel>
          <details className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Datos del archivo y detalle de movimientos
            </summary>
            <p className="mt-3 text-sm">
              El corte contiene <strong>{number(selected.total)}</strong> resultados;{" "}
              <strong>{number(selected.closed)}</strong> figuran resueltos o aprobados, incluidos
              cierres anteriores. Es el estado del archivo, no la cantidad cerrada entre estos dos
              cortes.
            </p>
            {!selected.initial && (
              <p className="mt-2 text-xs text-muted-foreground">
                «Se cerraron» en el balance principal cuenta únicamente los cambios de pendiente a
                cerrado entre {selected.fromDate} y {selected.date}. Por eso puede diferir de los
                resueltos presentes en el archivo.
              </p>
            )}
            {!selected.initial && movementDetails.length > 0 && (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Origen de las entradas y otras salidas</th>
                    <th className="p-2 text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {movementDetails.map(([kind, value]) => (
                    <tr key={kind} className="border-t">
                      <td className="p-2">{MOVEMENT_LABELS[kind as MovementKind]}</td>
                      <td className="p-2 text-right">{number(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </details>
          {plan && (
            <Panel
              title="Seguimiento del compromiso guardado"
              subtitle={`Base: ${plan.cutDate} · ${number(plan.baseCount)} resultados. Estos indicadores conservan el alcance original del plan.`}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [
                    "Meta acumulada al corte",
                    due ? number(due.cumulative) : "Fuera del calendario",
                    due
                      ? `Última meta prevista: ${due.date}`
                      : "No hay una meta anterior al corte elegido",
                  ],
                  [
                    "Cerrados de la base · XML",
                    membership && base && selected.date >= plan.cutDate
                      ? number(membership.closed)
                      : "Falta el corte original",
                    membership && base && selected.date >= plan.cutDate
                      ? `${number(membership.missing)} ausentes · ${number(membership.unmatched)} sin vincular. Los ausentes no cuentan como cierres.`
                      : "Incluye la fecha original de la base en el período",
                  ],
                  [
                    "Avance validado · manual",
                    lastManual ? number(lastManual.actual!) : "Sin registrar",
                    lastManual
                      ? `${((lastManual.actual! / plan.baseCount) * 100).toFixed(1)}% de la base al ${lastManual.date}`
                      : "Se registra en Plan de resolución; no se copia del XML",
                  ],
                ].map(([label, value, hint]) => (
                  <div key={label} className="rounded-lg border p-3">
                    <p className="text-sm">{label}</p>
                    <p className="my-2 text-2xl font-semibold">{value}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                ))}
              </div>
              {lastManual && lastManual.cumulative > 0 && (
                <p className="mt-3 text-sm">
                  Cumplimiento manual al {lastManual.date}: {number(lastManual.actual!)} registrados
                  / {number(lastManual.cumulative)} comprometidos ={" "}
                  {((lastManual.actual! / lastManual.cumulative) * 100).toFixed(1)}%. Se compara la
                  misma fecha y la misma base.
                </p>
              )}
            </Panel>
          )}
          <Panel
            title="Variación por especialidad o test"
            subtitle="Cada resultado se cuenta una vez por par. Una especialidad participante no indica quién causó el clash."
          >
            <p className="mb-3 text-sm">
              {selected.initial
                ? "Selecciona otro corte para comparar entradas y cierres."
                : `${selected.fromDate} → ${selected.date}: ${number(selected.opening)} pendientes iniciales + ${number(movements!.entries)} entradas − ${number(selected.counts.closed)} cerrados − ${number(movements!.otherExits)} otras salidas = ${number(selected.pending)} pendientes finales.`}
            </p>
            <label className="flex items-center gap-3 text-sm">
              Agrupar por
              <select
                className="rounded border bg-background p-2"
                value={breakdownMode}
                onChange={(e) => setBreakdownMode(e.target.value as "pair" | "test")}
              >
                <option value="pair">Par de especialidades</option>
                <option value="test">Test</option>
              </select>
            </label>
            <div
              className="sticky top-0 z-10 my-3 flex flex-wrap gap-5 rounded border bg-card p-3 text-sm"
              aria-label="Leyenda del desglose"
            >
              <span>
                <span className="mr-2 inline-block h-3 w-5 bg-amber-600" />
                Naranja: entradas de pendientes
              </span>
              <span>
                <span className="mr-2 inline-block h-3 w-5 bg-emerald-600" />
                Verde: cerrados en el período (XML)
              </span>
            </div>
            <div className="max-h-[600px] overflow-auto">
              <div className="min-w-[700px]" dangerouslySetInnerHTML={{ __html: breakdownGraph }} />
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      "Encuentro",
                      "Inicio",
                      "Entradas",
                      "Cerrados en el período",
                      "Otras salidas",
                      "Pendiente final",
                      "Cambio",
                    ].map((t) => (
                      <th key={t} className="p-2 text-left">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((r) => (
                    <tr key={r.label} className="border-t">
                      {[
                        r.label,
                        r.opening,
                        r.entries,
                        r.closed,
                        r.exits,
                        r.pending,
                        r.pending - r.opening,
                      ].map((v, i) => (
                        <td key={i} className="p-2">
                          {typeof v === "number" ? number(v) : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel
            title="Lectura ejecutiva del período"
            subtitle="Barras: entradas frente a cierres. Circular: carga del período repartida en cerrados, pendientes y otras salidas; inicio y entradas se muestran como contexto."
          >
            <div className="overflow-auto">
              <div className="min-w-[700px]" dangerouslySetInnerHTML={{ __html: graphs.summary }} />
            </div>
            <p className="text-xs text-muted-foreground">
              Los cierres XML son cambios de estado observados. La cobertura incorporada aumenta el
              inventario comparado, pero no prueba un cambio de diseño.
            </p>
          </Panel>
          <Panel
            title="¿Cumplimos el compromiso original?"
            subtitle="Planeado original frente al avance real manual. La comparación mantiene la base guardada."
          >
            {plan ? (
              <>
                <div className="overflow-auto">
                  <div
                    className="min-w-[700px]"
                    dangerouslySetInnerHTML={{ __html: graphs.commitment }}
                  />
                </div>
                {planErrors(plan).length > 0 && (
                  <p role="alert" className="text-sm text-destructive">
                    {planErrors(plan).join(" ")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Para registrar la curva S, usa cierres validados de los resultados de la base
                  original, acumulados desde su fecha. La tarjeta «Base original cerrada en XML» es
                  una referencia para revisarlos; los cierres de clashes nuevos no representan
                  avance de esa base. Las entradas adicionales se reflejan en «Pendiente observado y
                  proyección», sin mover la meta original.
                </p>
                <p className="text-xs text-muted-foreground">
                  {Object.keys(plan.actuals).length
                    ? "Los puntos naranjas corresponden a entradas manuales del plan, no a cierres inferidos del XML."
                    : "No hay avance real manual registrado. Ingresa acumulados en Plan de resolución."}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecciona o crea una línea base para comparar el compromiso. El control observado
                funciona sin ella.
              </p>
            )}
          </Panel>
          <Panel
            title="Proyección vigente"
            subtitle="Guarda escenarios sin modificar la línea base. Las entradas incluyen la carga semanal adicional esperada; la capacidad debe corresponder al alcance seleccionado."
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm">
                Cierres previstos / semana
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Ej. 1500"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Entradas previstas / semana
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={arrivals}
                  onChange={(e) => setArrivals(e.target.value)}
                  placeholder="Ej. 300"
                />
              </label>
              <Button onClick={saveForecast}>Guardar nueva proyección</Button>
            </div>
            {applicable.length > 0 && (
              <label className="mt-3 grid gap-1 text-sm">
                Versiones del mismo alcance y corte
                <select
                  className="rounded border bg-background p-2"
                  value={forecast?.id ?? ""}
                  onChange={(e) => setVersionId(e.target.value)}
                >
                  {applicable.map((v) => (
                    <option key={v.id} value={v.id}>
                      {new Date(v.createdAt).toLocaleString("es-PE", { timeZone: "America/Lima" })}{" "}
                      · {v.closuresPerWeek} cierres / {v.arrivalsPerWeek} entradas por semana
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="mt-3 text-sm">
              {forecastResult
                ? forecastResult.completion
                  ? `Cierre estimado: ${forecastResult.completion} · ${forecastResult.weeks} semanas con estos supuestos.${forecastResult.truncated ? " La gráfica se limita a 104 semanas." : ""}`
                  : "Sin convergencia: las entradas igualan o superan los cierres previstos."
                : "Sin proyección guardada para este alcance y corte. No se inventa una fecha de cierre."}
            </p>
            <details className="mt-3 rounded border p-3">
              <summary className="cursor-pointer text-xs">
                Historial de proyecciones guardadas · {versions.value.length}
              </summary>
              <div className="max-h-48 overflow-auto text-xs">
                {versions.value.map((v) => (
                  <p key={v.id} className="border-b py-2">
                    Corte {v.cutDate} · {v.pending} pendientes · {v.closuresPerWeek} cierres /{" "}
                    {v.arrivalsPerWeek} entradas semanales · guardada{" "}
                    {new Date(v.createdAt).toLocaleString("es-PE", { timeZone: "America/Lima" })}
                  </p>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() =>
                  downloadFile(
                    "proyecciones-control.json",
                    JSON.stringify(versions.value, null, 2),
                    "application/json",
                  )
                }
              >
                Respaldar proyecciones JSON
              </Button>
              <input
                ref={restoreInput}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => void restoreForecasts(event.target.files?.[0])}
              />
              <Button
                className="ml-2 mt-2"
                variant="outline"
                size="sm"
                onClick={() => restoreInput.current?.click()}
              >
                Restaurar proyecciones JSON
              </Button>
            </details>
          </Panel>
          <Panel
            title="¿Cuánto queda y cuándo terminaríamos?"
            subtitle="El planeado conserva el alcance original. La línea observada y la proyección corresponden al alcance indicado arriba."
          >
            {plan && !inventoryMatchesBase && (
              <p className="mb-3 rounded border bg-muted/30 p-3 text-xs">
                La selección actual no coincide con los pendientes de la base original. Se omite su
                línea de pendiente planeado para evitar comparar alcances distintos. El gráfico de
                compromiso original conserva sus metas.
              </p>
            )}
            <div className="overflow-auto">
              <div
                className="min-w-[700px]"
                dangerouslySetInnerHTML={{ __html: graphs.inventory }}
              />
            </div>
          </Panel>
          <Panel
            title="¿Por qué cambió el pendiente?"
            subtitle={`Los intervalos pueden ser mayores a una semana. ${selected.initial ? "Sin corte anterior." : `Desde ${selected.fromDate} hasta ${selected.date} · inicio ${number(selected.opening)} · cierre ${number(selected.pending)}.`}`}
          >
            <details className="mb-3 rounded border p-3 text-sm">
              <summary className="cursor-pointer">Cómo se calcula el balance</summary>
              {periodNarrative(selected).map((line) => (
                <p key={line} className="mt-2">
                  {line}
                </p>
              ))}
            </details>
            <div className="overflow-auto">
              <div className="min-w-[700px]" dangerouslySetInnerHTML={{ __html: graphs.balance }} />
            </div>
            <p className="text-xs text-muted-foreground">
              Las salidas por ausencia, cobertura o reclasificación reducen el inventario observado,
              pero no acreditan trabajo resuelto.
            </p>
          </Panel>
          <Panel
            title="Conciliación por corte"
            subtitle="Cada fila concilia: inicio + entradas - salidas = pendiente final. Selecciona un corte para actualizar los gráficos."
          >
            <div className="overflow-auto">
              <table className="w-full min-w-[1500px] text-xs">
                <thead>
                  <tr className="text-left">
                    <th>Corte</th>
                    <th>Inicio</th>
                    {Object.values(MOVEMENT_LABELS).map((label) => (
                      <th key={label} className="max-w-28 p-2">
                        {label}
                      </th>
                    ))}
                    <th>Pendiente final</th>
                    <th>Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {cuts.map((c) => (
                    <tr
                      key={c.key}
                      className={`border-t ${c.key === selected.key ? "bg-primary/5" : ""}`}
                    >
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCutKey(c.key);
                          }}
                        >
                          {c.date}
                        </Button>
                      </td>
                      <td>{c.opening}</td>
                      {Object.keys(MOVEMENT_LABELS).map((k) => (
                        <td key={k} className="p-2">
                          {c.initial ? "—" : c.counts[k as MovementKind]}
                        </td>
                      ))}
                      <td className="font-semibold">{c.pending}</td>
                      <td>{c.initial ? "Base" : c.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel
            title="Reporte ejecutivo"
            subtitle="El PDF conserva el corte, alcance y supuestos seleccionados; incluye las gráficas resumen, las curvas y la conciliación."
          >
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void pdf()}>
                {busy ? "Preparando…" : "Exportar reporte ejecutivo PDF"}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  downloadFile(
                    `conciliacion-${selected.date}.csv`,
                    controlCsv(report),
                    "text/csv;charset=utf-8",
                  )
                }
              >
                Conciliación CSV
              </Button>
              {Object.entries(graphs).map(([key, svg]) => (
                <Button
                  key={key}
                  variant="outline"
                  onClick={() =>
                    downloadFile(`control-${key}-${selected.date}.svg`, svg, "image/svg+xml")
                  }
                >
                  {CONTROL_GRAPH_LABELS[key as keyof typeof CONTROL_GRAPH_LABELS]} SVG
                </Button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeAppendix}
                onChange={(event) => setIncludeAppendix(event.target.checked)}
              />
              Incluir anexo de conciliación y alcance en el PDF
            </label>
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Notas de interpretación
              </summary>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
            {balances.some((c) => c.duplicates > 0) && (
              <p className="mt-2 text-sm text-destructive">
                Hay identidades duplicadas dentro de un corte; se muestran una sola vez. Revisa los
                XML antes de emitir el reporte.
              </p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
