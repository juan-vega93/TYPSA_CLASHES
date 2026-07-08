import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useDeferredValue, useMemo, useRef, useState } from "react";
import { Search, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClashes } from "@/lib/use-clashes";
import { useClashState } from "@/lib/use-clash-state";
import { FiltersBar } from "@/components/dashboard/filters";
import { KpiCards } from "@/components/dashboard/kpis";
import {
  buildClashIndex,
  getGlobalBounds,
  queryClashes,
  summarizeClashes,
  type FilterState,
} from "@/lib/clash-query";
import type { Clash } from "@/lib/clash-types";

const ResumenTab = lazy(() =>
  import("@/components/dashboard/tab-resumen").then((m) => ({ default: m.ResumenTab }))
);
const UbicacionTab = lazy(() =>
  import("@/components/dashboard/tab-ubicacion").then((m) => ({ default: m.UbicacionTab }))
);
const ElementosTab = lazy(() =>
  import("@/components/dashboard/tab-elementos").then((m) => ({ default: m.ElementosTab }))
);
const GestionTab = lazy(() =>
  import("@/components/dashboard/tab-gestion").then((m) => ({ default: m.GestionTab }))
);
const CalidadTab = lazy(() =>
  import("@/components/dashboard/tab-calidad").then((m) => ({ default: m.CalidadTab }))
);
const TimelineTab = lazy(() =>
  import("@/components/dashboard/tab-timeline").then((m) => ({ default: m.TimelineTab }))
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

type TabId = "resumen" | "ubicacion" | "elementos" | "gestion" | "calidad" | "timeline";

function applyStatusOverrides(clashes: Clash[], overrides: Record<string, { status?: Clash["status"] }>) {
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
  const { clashes, snapshots, ingestFiles, clearExtras, hasExtras, isLoading, isParsing, errors } = useClashes();
  const { data: state, update, reset } = useClashState();
  const [filters, setFilters] = useState<FilterState>({});
  const deferredFilters = useDeferredValue(filters);
  const [activeTab, setActiveTab] = useState<TabId>("resumen");
  const inputRef = useRef<HTMLInputElement>(null);

  const withOverrides = useMemo(
    () => applyStatusOverrides(clashes, state.overrides),
    [clashes, state.overrides]
  );
  const index = useMemo(() => buildClashIndex(withOverrides), [withOverrides]);
  const filtered = useMemo(
    () => queryClashes(index, deferredFilters),
    [index, deferredFilters]
  );
  const metrics = useMemo(() => summarizeClashes(filtered), [filtered]);
  const globalBounds = useMemo(() => getGlobalBounds(clashes), [clashes]);
  const timelineSnapshots = useMemo(
    () =>
      snapshots.map((snapshot) => ({
        ...snapshot,
        clashes: queryClashes(buildClashIndex(applyStatusOverrides(snapshot.clashes, state.overrides)), deferredFilters),
      })),
    [snapshots, state.overrides, deferredFilters]
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
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-4 px-6 py-6">
        {errors.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errors.length} archivo(s) XML no pudieron procesarse. Revisa consola para el detalle.
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)} className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-full bg-muted/60 p-1">
            <TabsTrigger value="resumen" className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">Resumen</TabsTrigger>
            <TabsTrigger value="ubicacion" className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">Ubicacion &amp; Mapa</TabsTrigger>
            <TabsTrigger value="elementos" className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">Elementos &amp; Pares</TabsTrigger>
            <TabsTrigger value="gestion" className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">Gestion de avance</TabsTrigger>
            <TabsTrigger value="calidad" className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">Calidad de datos</TabsTrigger>
            <TabsTrigger value="timeline" className="rounded-full px-4 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">Linea de tiempo</TabsTrigger>
          </TabsList>

          <FiltersBar
            all={withOverrides}
            filtered={filtered}
            options={index.options}
            value={filters}
            onChange={setFilters}
          />
          <KpiCards allCount={withOverrides.length} metrics={metrics} />

          <Suspense fallback={<LoadingPanel />}>
            {activeTab === "resumen" && <ResumenTab clashes={filtered} />}
            {activeTab === "ubicacion" && (
              <UbicacionTab clashes={filtered} globalBounds={globalBounds} />
            )}
            {activeTab === "elementos" && <ElementosTab clashes={filtered} />}
            {activeTab === "gestion" && (
              <GestionTab clashes={filtered} overrides={state.overrides} onUpdate={update} />
            )}
            {activeTab === "calidad" && <CalidadTab clashes={filtered} />}
            {activeTab === "timeline" && (
              <TimelineTab clashes={filtered} snapshots={timelineSnapshots} overrides={state.overrides} />
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
