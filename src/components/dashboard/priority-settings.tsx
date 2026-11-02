import type { Clash } from "@/lib/clash-types";
import { encounterGroup, isHanger } from "@/lib/clash-importance";
import {
  canonicalCategory,
  DEFAULT_COORDINATION_RULES,
  type CoordinationRules,
} from "@/lib/coordination-priority";
import { Panel } from "./panel";
import { Button } from "@/components/ui/button";
export function PrioritySettings({
  clashes,
  rules,
  onChange,
}: {
  clashes: Clash[];
  rules: CoordinationRules;
  onChange: (rules: CoordinationRules) => void;
}) {
  const categories = [...new Set(clashes.flatMap((clash) => clash.items.map(encounterGroup)))]
    .filter((value) => value !== "Categoría no exportada")
    .sort((a, b) => a.localeCompare(b, "es"));
  const list = (
    key: "priorityCategories" | "openingCategories" | "serviceCategories",
    title: string,
  ) => (
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {title} · {rules[key].length} elegidas
      </summary>
      <div className="mt-3 grid max-h-60 grid-cols-1 gap-1 overflow-auto sm:grid-cols-2">
        {[...new Set([...categories, ...rules[key]])].sort().map((category) => {
          const checked = rules[key].some(
            (value) => canonicalCategory(value) === canonicalCategory(category),
          );
          return (
            <label
              key={category}
              className="flex items-start gap-2 rounded bg-muted/30 p-2 text-xs"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  onChange({
                    ...rules,
                    [key]: event.target.checked
                      ? [...new Set([...rules[key], category])]
                      : rules[key].filter(
                          (value) => canonicalCategory(value) !== canonicalCategory(category),
                        ),
                  })
                }
              />
              {category}
            </label>
          );
        })}
      </div>
    </details>
  );
  return (
    <Panel
      title="Categorías para priorizar"
      subtitle="La prioridad se define por el elemento afectado. Es independiente de la penetración y se comparte con la planificación."
      right={
        <Button variant="outline" size="sm" onClick={() => onChange(DEFAULT_COORDINATION_RULES)}>
          Selección estructural
        </Button>
      }
    >
      <div className="grid gap-3 lg:grid-cols-3">
        {list("priorityCategories", "Elementos prioritarios C1 / C2")}
        {list("openingCategories", "Elementos receptores de posibles pases")}
        {list("serviceCategories", "Redes que pueden requerir pases")}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={rules.excludeHangers}
          onChange={(e) => onChange({ ...rules, excludeHangers: e.target.checked })}
        />
        Separar colgadores en C4 (detectados por familia)
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        {clashes.filter((clash) => clash.items.some(isHanger)).length.toLocaleString("es-PE")}{" "}
        resultados con colgadores en el corte.
        {rules.excludeHangers
          ? " Se conservan en el total y se apartan de las prioridades C1/C2."
          : " Separación desactivada: también pueden aparecer en C1/C2 según la categoría del otro objeto."}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Una categoría prioritaria prevalece sobre un candidato a pase. C3 no confirma una abertura
        ni una excepción por diámetro; requiere validación antes de automatizar su tratamiento.
      </p>
    </Panel>
  );
}
