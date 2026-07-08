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
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Clash } from "@/lib/clash-types";
import type { FilterKey, FilterState } from "@/lib/clash-query";

const DEFS: {
  key: FilterKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "test", label: "Test", icon: Activity },
  { key: "status", label: "Estado", icon: ShieldCheck },
  { key: "severity", label: "Severidad", icon: AlertTriangle },
  { key: "zona", label: "Zona", icon: MapPin },
  { key: "nivel", label: "Nivel", icon: Building2 },
  { key: "edificio", label: "Edificio", icon: Layers },
  { key: "sector", label: "Sector", icon: Grid },
  { key: "categoria", label: "Par categ.", icon: Activity },
  { key: "contenedor", label: "Contenedor", icon: Package },
  { key: "prioridad", label: "Prioridad", icon: Flag },
];

export const FiltersBar = memo(function FiltersBar({
  all,
  filtered,
  options,
  value,
  onChange,
}: {
  all: Clash[];
  filtered: Clash[];
  options: Record<FilterKey, string[]>;
  value: FilterState;
  onChange: (v: FilterState) => void;
}) {
  const activeCount = DEFS.filter((d) => {
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
        {DEFS.map((d) => {
          const opts = options[d.key];
          const v = value[d.key] ?? "__all__";
          return (
            <Select
              key={d.key}
              value={v}
              onValueChange={(next) => onChange({ ...value, [d.key]: next })}
            >
              <SelectTrigger className="h-9 w-[150px] rounded-full border-border/70 bg-background/60 text-sm">
                <SelectValue placeholder={d.label}>
                  <d.icon className="mr-1 h-4 w-4 text-muted-foreground" />
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
