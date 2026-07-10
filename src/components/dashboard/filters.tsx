import { memo } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  Filter,
  Flag,
  Grid,
  Layers,
  MapPin,
  Package,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Clash } from "@/lib/clash-types";
import type { FilterState, RuntimeFilterDef } from "@/lib/clash-query";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  test: Activity,
  status: ShieldCheck,
  severity: AlertTriangle,
  zona: MapPin,
  nivel: Building2,
  edificio: Layers,
  sector: Grid,
  categoria: Activity,
  contenedor: Package,
  prioridad: Flag,
};

export const FiltersBar = memo(function FiltersBar({
  all,
  filtered,
  options,
  filterDefs,
  value,
  onChange,
}: {
  all: Clash[];
  filtered: Clash[];
  options: Record<string, string[]>;
  filterDefs: RuntimeFilterDef[];
  value: FilterState;
  onChange: (v: FilterState) => void;
}) {
  const activeCount = filterDefs.filter((d) => {
    const v = value[d.key];
    return v && v !== "__all__";
  }).length;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        Filtros - {activeCount} activo(s) - {filtered.length} / {all.length} clashes
      </div>
      <div className="flex flex-wrap gap-2">
        {filterDefs.map((d) => {
          const Icon = ICONS[d.key] ?? SlidersHorizontal;
          const opts = options[d.key] ?? [];
          const v = value[d.key] ?? "__all__";
          return (
            <Select
              key={d.key}
              value={v}
              onValueChange={(next) => onChange({ ...value, [d.key]: next })}
            >
              <SelectTrigger className="h-9 w-[150px] rounded-full border-border/70 bg-background/60 text-sm">
                <SelectValue placeholder={d.label}>
                  <Icon className="mr-1 h-4 w-4 text-muted-foreground" />
                  {d.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__all__">Todos</SelectItem>
                {opts.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}
      </div>
    </div>
  );
});
