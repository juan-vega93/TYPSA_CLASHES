import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useDeferredValue, useMemo, useRef, useState } from "react";
import { Search, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClashes } from "@/lib/use-clashes";
import { useClashState } from "@/lib/use-clash-state";
import { useProjectConfig } from "@/lib/project-config";
import { FiltersBar } from "@/components/dashboard/filters";
import { KpiCards } from "@/components/dashboard/kpis";
import { ProjectSettingsDialog } from "@/components/dashboard/project-settings-dialog";
import {
  buildClashIndex,
  getGlobalBounds,
  queryClashes,
  summarizeClashes,
  compileClashFilter,
  type FilterState,
} from "@/lib/clash-query";
import type { Clash } from "@/lib/clash-types";
import { DEFAULT_COORDINATION_RULES, validCoordinationRules } from "@/lib/coordination-priority";
import { useStoredState } from "@/lib/use-stored-state";
import type { PlanningRequest } from "@/lib/coordination-plan";
import type { HistoryRange } from "@/lib/snapshot-folders";
import { HistoryRangePicker } from "@/components/dashboard/history-range-picker";

const ResumenTab = lazy(() =>
  import("@/components/dashboard/tab-resumen").then((m) => ({ default: m.ResumenTab })),
);
const UbicacionTab = lazy(() =>
  import("@/components/dashboard/tab-ubicacion").then((m) => ({ default: m.UbicacionTab })),
);
const ElementosTab = lazy(() =>
  import("@/components/dashboard/tab-elementos").then((m) => ({ default: m.ElementosTab })),
);
const GestionTab = lazy(() =>
  import("@/components/dashboard/tab-gestion").then((m) => ({ default: m.GestionTab })),
);
const CalidadTab = lazy(() =>
  import("@/components/dashboard/tab-calidad").then((m) => ({ default: m.CalidadTab })),
);
const TimelineTab = lazy(() =>
  import("@/components/dashboard/tab-timeline").then((m) => ({ default: m.TimelineTab })),
);
const PlanTab = lazy(() =>
  import("@/components/dashboard/tab-plan").then((m) => ({ default: m.PlanTab })),
);
const ImportanciaTab = lazy(() =>
  import("@/components/dashboard/tab-importancia").then((m) => ({ default: m.ImportanciaTab })),
);
const ControlTab = lazy(() =>
  import("@/components/dashboard/tab-control").then((m) => ({ default: m.ControlTab })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clash Control Center - Navisworks BIM Dashboard" },
      {
        name: "description",
        content:
          "Dashboard para gestionar interferencias de Navisworks: metricas, mapa espacial, avance, calidad de datos y linea de tiempo.",
      },
      { property: "og:title", content: "Clash Control Center" },
      {
        property: "og:description",
        content:
          "Dashboard BIM para gestionar interferencias de Navisworks con metricas, mapa espacial y linea de tiempo.",
      },
    ],
  }),
  component: Index,
});

type TabId =
  | "resumen"
  | "ubicacion"
  | "elementos"
  | "gestion"
  | "calidad"
  | "timeline"
  | "plan"
  | "control"
  | "importancia";

function applyStatusOverrides(
  clashes: Clash[],
  overrides: Record<string, { status?: Clash["status"] }>,
) {
  let changed = false;
  const out = clashes.map((c) => {
    const status = overrides[c.id]?.status;
    if (!status || status === c.status) return c;
    changed = true;
    return { ...c, status };
  });
  return changed ? out : clashes;
}

function LoadingPanel() {
  return (
    <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
      Preparando vista...
    </div>
  );
}

export function Index() {
  const { config, hasOverride, saveConfig, restoreDefaults, exportConfig } = useProjectConfig();
  const [activeTab, setActiveTab] = useState<TabId>("resumen");
  const [historyRange, setHistoryRange] = useState<HistoryRange>();
  const historicalTab = activeTab === "timeline" || activeTab === "control" || activeTab === "plan";
  const {
    clashes,
    snapshots,
    historySnapshots,
    historyErrors,
    availableCuts,
    isHistoryLoading,
    historyProgress,
    ingestFiles,
    clearExtras,
    hasExtras,
    isLoading,
    isParsing,
    errors,
  } = useClashes(config, historicalTab ? historyRange : undefined);
  const { data: state, update, reset } = useClashState();
  const [filters, setFilters] = useState<FilterState>({});
  const deferredFilters = useDeferredValue(filters);
  const inputRef = useRef<HTMLInputElement>(null);
  const priority = useStoredState(
    "typsa-coordination-rules-v1",
    DEFAULT_COORDINATION_RULES,
    validCoordinationRules,
  );
  const [planningRequest, setPlanningRequest] = useState<PlanningRequest | null>(null);
  const [planToOpen, setPlanToOpen] = useState<string | undefined>();

  const withOverrides = useMemo(
    () => applyStatusOverrides(clashes, state.overrides),
    [clashes, state.overrides],
  );
  const index = useMemo(() => buildClashIndex(withOverrides, config), [withOverrides, config]);
  const filtered = useMemo(() => queryClashes(index, deferredFilters), [index, deferredFilters]);
  const metrics = useMemo(() => summarizeClashes(filtered), [filtered]);
  const globalBounds = useMemo(() => getGlobalBounds(clashes), [clashes]);
  const timelineFilter = useMemo(
    () => compileClashFilter(config, deferredFilters),
    [config, deferredFilters],
  );

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}typsa-logo.jpg`}
              alt="TYPSA"
              className="h-12 w-12 rounded-md object-cover shadow-[var(--shadow-soft)]"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#c8102e]">AR3173-IREN SUR</h1>
              <p className="text-xs text-muted-foreground">
                Dashboard de gestion de clashes - {clashes.length} clashes cargados
                {snapshots.length > 0
                  ? ` · Corte ${snapshots[snapshots.length - 1].date.split("-").reverse().join("/")}`
                  : ""}
                {isLoading || isParsing ? " - procesando XML" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.search ?? ""}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Buscar clash, Element ID, familia, zona..."
                className="h-9 w-72 rounded-full pl-9 text-sm"
              />
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xml"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && ingestFiles(e.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => inputRef.current?.click()}
              disabled={isParsing}
            >
              <Upload className="h-3.5 w-3.5" />
              Cargar mas
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              title="Limpiar overrides y XML cargados"
              onClick={() => {
                if (hasExtras) clearExtras();
                reset();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <ProjectSettingsDialog
              config={config}
              hasOverride={hasOverride}
              onSave={(nextConfig) => {
                saveConfig(nextConfig);
                setFilters({});
              }}
              onRestoreDefaults={() => {
                restoreDefaults();
                setFilters({});
              }}
              onExport={exportConfig}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-4 px-6 py-6">
        {availableCuts.some(
          (cut) =>
            cut.date >
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Lima",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date()),
        ) && (
          <p className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Hay carpetas con fechas futuras. Revisa sus nombres AAMMDD: el orden de fechas determina
            el corte actual y las opciones históricas. No se modifica ni excluye su contenido
            automáticamente.
          </p>
        )}
        {errors.length > 0 && (
          <details className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <summary className="cursor-pointer">
              {errors.length} archivo(s) XML no pudieron procesarse. Ver detalle.
            </summary>
            <ul className="mt-2 list-disc pl-5">
              {errors.map((error, index) => (
                <li key={`${error.name}-${index}`}>
                  {error.name}: {error.message}
                </li>
              ))}
            </ul>
          </details>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabId)}
          className="space-y-4"
        >
          <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-full bg-muted/60 p-1">
            <TabsTrigger
              value="control"
              className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Control de compromisos
            </TabsTrigger>
            <TabsTrigger
              value="importancia"
              className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Matriz de importancia
            </TabsTrigger>
            <TabsTrigger
              value="plan"
              className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Plan de resolución · Curva S
            </TabsTrigger>
            <TabsTrigger
              value="resumen"
              className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Resumen
            </TabsTrigger>
            <TabsTrigger
              value="ubicacion"
              className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Ubicacion &amp; Mapa
            </TabsTrigger>
            <TabsTrigger
              value="elementos"
              className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Elementos &amp; Pares
            </TabsTrigger>
            <TabsTrigger
              value="gestion"
              className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Gestion de avance
            </TabsTrigger>
            <TabsTrigger
              value="calidad"
              className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Calidad de datos
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Linea de tiempo
            </TabsTrigger>
          </TabsList>

          {activeTab !== "control" && (
            <FiltersBar
              all={withOverrides}
              filtered={filtered}
              options={index.options}
              levelOptions={index.levelOptions}
              filterDefs={index.filterDefs}
              value={filters}
              onChange={setFilters}
            />
          )}
          {activeTab !== "resumen" && activeTab !== "control" && (
            <KpiCards allCount={withOverrides.length} metrics={metrics} />
          )}
          {priority.error && (
            <p role="alert" className="rounded border border-destructive/30 p-3 text-sm">
              Categorías de prioridad: {priority.error}
            </p>
          )}

          <Suspense fallback={<LoadingPanel />}>
            {historicalTab && (
              <HistoryRangePicker
                cuts={availableCuts}
                range={historyRange}
                onGenerate={setHistoryRange}
                loading={isHistoryLoading}
                progress={historyProgress}
              />
            )}
            {historicalTab && !historyRange && (
              <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                Elige inicio y fin y pulsa «Generar período». Se propone el intervalo de los dos
                cortes más recientes para comenzar con una carga menor.
              </div>
            )}
            {activeTab === "control" && historyRange && (
              <ControlTab
                snapshots={historySnapshots}
                config={config}
                rules={priority.value}
                loading={isHistoryLoading}
                dataErrors={historyErrors.length}
                onPlan={(id) => {
                  setPlanningRequest(null);
                  setPlanToOpen(id);
                  setActiveTab("plan");
                }}
              />
            )}
            {activeTab === "importancia" && (
              <ImportanciaTab
                clashes={filtered}
                allClashes={withOverrides}
                rules={priority.value}
                onRulesChange={priority.update}
                onPlan={(rows, label) => {
                  setPlanToOpen(undefined);
                  setPlanningRequest({
                    ids: rows.map((row) => row.id),
                    label,
                    revision: Date.now(),
                  });
                  setActiveTab("plan");
                }}
                filters={deferredFilters}
                overrides={state.overrides}
                onUpdate={update}
                loading={isLoading || isParsing}
                cutDate={snapshots[snapshots.length - 1]?.date}
              />
            )}
            {activeTab === "plan" && (
              <PlanTab
                snapshots={historySnapshots}
                config={config}
                historyLoading={isHistoryLoading}
                clashes={filtered}
                allClashes={withOverrides}
                rules={priority.value}
                request={planningRequest}
                initialPlanId={planToOpen}
                filters={deferredFilters}
                cutDate={snapshots[snapshots.length - 1]?.date}
                loading={isLoading || isParsing}
              />
            )}
            {activeTab === "resumen" && (
              <ResumenTab
                clashes={filtered}
                allCount={withOverrides.length}
                rules={priority.value}
                cutDate={snapshots[snapshots.length - 1]?.date}
                onConfigure={() => setActiveTab("importancia")}
              />
            )}
            {activeTab === "ubicacion" && (
              <UbicacionTab clashes={filtered} globalBounds={globalBounds} />
            )}
            {activeTab === "elementos" && <ElementosTab clashes={filtered} />}
            {activeTab === "gestion" && (
              <GestionTab clashes={filtered} overrides={state.overrides} onUpdate={update} />
            )}
            {activeTab === "calidad" && <CalidadTab clashes={filtered} />}
            {activeTab === "timeline" && historyRange && (
              <TimelineTab
                clashes={filtered}
                snapshots={historySnapshots}
                include={timelineFilter}
                loading={isHistoryLoading}
                overrides={state.overrides}
              />
            )}
          </Suspense>
        </Tabs>

        <footer className="pt-4 text-center text-[11px] text-muted-foreground">
          Deja tus archivos XML en <code className="rounded bg-muted px-1.5 py-0.5">src/data/</code>
          para que se carguen automaticamente al hacer build.
        </footer>
      </div>
    </main>
  );
}
