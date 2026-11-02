import { memo } from "react";
import { Filter, SlidersHorizontal } from "lucide-react";
import type { Clash } from "@/lib/clash-types";
import type { FilterState, RuntimeFilterDef, LevelSource } from "@/lib/clash-query";
import { LevelFilter } from "./level-filter";
import { CheckboxFilter } from "./checkbox-filter";
import { Button } from "@/components/ui/button";
export const FiltersBar = memo(function FiltersBar({
  all,
  filtered,
  options,
  filterDefs,
  levelOptions,
  value,
  onChange,
}: {
  all: Clash[];
  filtered: Clash[];
  options: Record<string, string[]>;
  filterDefs: RuntimeFilterDef[];
  levelOptions: Record<LevelSource, string[]>;
  value: FilterState;
  onChange: (value: FilterState) => void;
}) {
  const activeCount = filterDefs.filter(
    (field) =>
      value[field.key] !== undefined && value[field.key] !== "__all__" && value[field.key] !== "",
  ).length;
  return (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Filter className="h-4 w-4" />
        Filtros · {activeCount} activos · {filtered.length} / {all.length} resultados
        {(activeCount > 0 || value.search) && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 normal-case"
            onClick={() => onChange({})}
          >
            Limpiar filtros
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {filterDefs.map((field) => {
          if (field.key === "nivel")
            return Object.values(levelOptions).some((values) =>
              values.some((item) => item !== "__missing_level__"),
            ) ? (
              <LevelFilter
                key={field.key}
                label={field.label}
                value={value}
                options={levelOptions}
                onChange={onChange}
              />
            ) : null;
          const values = (options[field.key] ?? []).filter(
            (item) => item.trim() && !/^sin(?: vs sin)?$/i.test(item),
          );
          if (!values.length) return null;
          return (
            <CheckboxFilter
              key={field.key}
              label={field.label}
              options={values}
              value={value[field.key]}
              onChange={(next) => onChange({ ...value, [field.key]: next })}
              icon={<SlidersHorizontal className="h-4 w-4 shrink-0" />}
              display={(item) =>
                field.key === "status"
                  ? ({
                      active: "Activo / nuevo",
                      reviewed: "Revisado",
                      approved: "Aprobado",
                      resolved: "Resuelto",
                    }[item] ?? item)
                  : item
              }
            />
          );
        })}
      </div>
    </div>
  );
});
