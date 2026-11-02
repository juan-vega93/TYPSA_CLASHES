import { useMemo, useState } from "react";
import type { Clash } from "@/lib/clash-types";
import type { ClashOverride } from "@/lib/use-clash-state";
import {
  CLASS_LABELS,
  createCoordinationClassifier,
  coordinationPair,
  isPending,
  summarizeCoordination,
  type CoordinationClass,
  type CoordinationRules,
} from "@/lib/coordination-priority";
import { encounterGroup, isHanger } from "@/lib/clash-importance";
import type { FilterState } from "@/lib/clash-query";
import { Button } from "@/components/ui/button";
import { Panel } from "./panel";
import { PrioritySettings } from "./priority-settings";
import { GestionTab } from "./tab-gestion";
const CLASSES: CoordinationClass[] = ["C1", "C2", "C3", "C4"];
const number = (value: number) => value.toLocaleString("es-PE");
export function ImportanciaTab({
  clashes,
  allClashes,
  rules,
  onRulesChange,
  onPlan,
  overrides,
  onUpdate,
  loading,
  cutDate,
  filters,
}: {
  clashes: Clash[];
  allClashes: Clash[];
  rules: CoordinationRules;
  onRulesChange: (rules: CoordinationRules) => void;
  onPlan: (rows: Clash[], label: string) => void;
  overrides: Record<string, ClashOverride>;
  onUpdate: (id: string, patch: ClashOverride) => void;
  loading: boolean;
  cutDate?: string;
  filters?: FilterState;
}) {
  const [test, setTest] = useState("all"),
    [pendingOnly, setPendingOnly] = useState(true),
    [selected, setSelected] = useState<CoordinationClass[]>(CLASSES),
    [pair, setPair] = useState("");
  const tests = useMemo(() => [...new Set(clashes.map((clash) => clash.test))].sort(), [clashes]);
  const currentTest = test === "all" || tests.includes(test) ? test : "all";
  const scope = useMemo(
    () =>
      clashes.filter(
        (clash) =>
          (currentTest === "all" || clash.test === currentTest) &&
          (!pendingOnly || isPending(clash)),
      ),
    [clashes, currentTest, pendingOnly],
  );
  const classify = useMemo(() => createCoordinationClassifier(rules), [rules]);
  const summary = useMemo(() => summarizeCoordination(scope, rules), [scope, rules]);
  const pairs = useMemo(() => {
    const result = new Map<string, { label: string; count: number }>();
    for (const clash of scope) {
      if (!selected.includes(classify(clash))) continue;
      const categories = coordinationPair(clash),
        key = JSON.stringify(categories),
        row = result.get(key) ?? { label: categories.join(" × "), count: 0 };
      row.count++;
      result.set(key, row);
    }
    return [...result].sort((a, b) => b[1].count - a[1].count);
  }, [scope, selected, classify]);
  const activePair = pairs.some(([key]) => key === pair) ? pair : "";
  const visible = useMemo(
    () =>
      scope.filter(
        (clash) =>
          selected.includes(classify(clash)) &&
          (!activePair || JSON.stringify(coordinationPair(clash)) === activePair),
      ),
    [scope, classify, selected, activePair],
  );
  const planRows = visible.filter(isPending);
  function exportCsv() {
    const cell = (value: unknown) =>
      `"${String(value ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows: unknown[][] = [
      [
        "Corte",
        "Test",
        "GUID",
        "Conflicto",
        "Grupo",
        "Estado XML",
        "Estado actual",
        "Prioridad",
        "Tratamiento",
        "Categoría A",
        "Categoría B",
        "ID A",
        "ID B",
        "Nivel A",
        "Nivel B",
        "Reglas",
        "Filtros",
        "Responsable",
        "Nota",
      ],
      ...visible.map((clash) => {
        const group = classify(clash);
        return [
          cutDate,
          clash.test,
          clash.id,
          clash.name,
          clash.kind === "group" ? "Sí" : "No",
          clash.sourceStatus,
          clash.status,
          group,
          CLASS_LABELS[group],
          ...clash.items.map(encounterGroup),
          ...clash.items.map((item) => item.elementId),
          ...clash.items.map((item) => item.nivel),
          JSON.stringify(rules),
          JSON.stringify(filters),
          overrides[clash.id]?.assignee,
          overrides[clash.id]?.note,
        ];
      }),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `segmentacion-${cutDate ?? "actual"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  if (loading)
    return (
      <Panel title="Segmentación de prioridades">
        <p>Procesando el corte…</p>
      </Panel>
    );
  return (
    <div className="space-y-4">
      <Panel
        title="Prioridades de coordinación"
        subtitle={`Corte ${cutDate ?? "actual"} · ${currentTest === "all" ? "Todos los tests del alcance" : currentTest} · ${number(scope.length)} resultados`}
      >
        <div className="flex flex-wrap items-center gap-4">
          <label className="grid gap-1 text-sm">
            Tests
            <select
              className="rounded border bg-background p-2"
              value={currentTest}
              onChange={(e) => {
                setTest(e.target.value);
                setPair("");
              }}
            >
              <option value="all">Todos los tests</option>
              {tests.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
            />
            Solo pendientes
          </label>
          <span className="text-xs text-muted-foreground">
            Se respetan los filtros generales de nivel, edificio, zona y demás campos.
          </span>
        </div>
      </Panel>
      <PrioritySettings clashes={allClashes} rules={rules} onChange={onRulesChange} />
      <Panel
        title="Resumen total por par de especialidades"
        subtitle="Se agrupan los mismos pares de todos los tests del alcance, incluidos los de orden inverso. Cada resultado se cuenta una vez; C1–C4 dependen de las categorías seleccionadas."
      >
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Par de especialidades</th>
                <th>Total</th>
                {CLASSES.map((group) => (
                  <th key={group}>{group}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.specialties.map(([key, row]) => (
                <tr key={key} className="border-b">
                  <td className="p-2">{key}</td>
                  <td>{number(row.total)}</td>
                  {CLASSES.map((group) => (
                    <td key={group}>{number(row[group])}</td>
                  ))}
                </tr>
              ))}
              <tr className="bg-muted/50 font-semibold">
                <td className="p-2">TOTAL</td>
                <td>{number(summary.total.total)}</td>
                {CLASSES.map((group) => (
                  <td key={group}>{number(summary.total[group])}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setSelected(["C1", "C2"]);
            setPair("");
          }}
        >
          Ver prioritarios C1 + C2
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setSelected(["C3"]);
            setPair("");
          }}
        >
          Ver candidatos a pases
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setSelected(CLASSES);
            setPair("");
          }}
        >
          Ver todos
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {CLASSES.map((group) => (
          <label
            key={group}
            className={`cursor-pointer rounded-xl border-t-4 p-4 shadow-sm ${group === "C1" ? "border-red-600 bg-red-50" : group === "C2" ? "border-orange-500 bg-orange-50" : group === "C3" ? "border-teal-600 bg-teal-50" : "border-slate-400 bg-slate-50"}`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={selected.includes(group)}
                onChange={(e) => {
                  setSelected(
                    e.target.checked
                      ? [...selected, group]
                      : selected.filter((item) => item !== group),
                  );
                  setPair("");
                }}
              />
              {group}
            </span>
            <strong className="block text-3xl">{number(summary.total[group])}</strong>
            <span className="text-xs">{CLASS_LABELS[group]}</span>
          </label>
        ))}
      </div>
      <Panel
        title="Encuentros por categoría"
        subtitle="Selecciona un par para acotar el detalle. Los colgadores se distinguen por familia y conservan su categoría nativa."
      >
        <div className="flex max-h-64 flex-wrap gap-2 overflow-auto">
          {pairs.map(([key, row]) => (
            <Button
              key={key}
              size="sm"
              variant={activePair === key ? "default" : "outline"}
              onClick={() => setPair(activePair === key ? "" : key)}
            >
              {row.label} · {number(row.count)}
            </Button>
          ))}
        </div>
      </Panel>
      <p className="text-xs text-muted-foreground">
        En este alcance: {number(scope.filter((clash) => clash.items.some(isHanger)).length)}{" "}
        resultados con colgadores.
        {rules.excludeHangers
          ? " Se incluyen en C4 junto con los demás encuentros sin categoría prioritaria ni candidato a pase."
          : " La separación está desactivada: pueden contar como prioritarios. Actívala en Categorías para priorizar para revisarlos en C4."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <strong>{number(visible.length)} resultados seleccionados</strong>
        <Button onClick={exportCsv} disabled={!visible.length}>
          Exportar segmentación CSV
        </Button>
        <Button
          onClick={() =>
            onPlan(
              planRows,
              `${currentTest === "all" ? "Todas las especialidades" : currentTest} · ${selected.join(" + ")}`,
            )
          }
          disabled={!planRows.length}
        >
          Planificar selección · {number(planRows.length)} pendientes
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        C1/C2 requieren coordinación prioritaria. C3 puede tratarse en paquetes o mediante
        automatización después de validar los pases. Un resultado agrupado de Navisworks cuenta como
        una unidad; no equivale al número de perforaciones ni de tareas.
      </p>
      <GestionTab
        key={`${currentTest}:${selected.join()}:${activePair}:${visible.length}`}
        clashes={visible}
        overrides={overrides}
        onUpdate={onUpdate}
      />
    </div>
  );
}
