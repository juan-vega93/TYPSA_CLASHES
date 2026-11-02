import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
export function CheckboxFilter({
  label,
  options,
  value,
  onChange,
  icon,
  children,
  display = (value) => value,
}: {
  label: string;
  options: string[];
  value?: string | string[];
  onChange: (value: string[] | undefined) => void;
  icon?: ReactNode;
  children?: ReactNode;
  display?: (value: string) => string;
}) {
  const enabled = value !== undefined && value !== "__all__",
    selected = enabled ? (Array.isArray(value) ? value : [value!]) : [],
    shown = [...new Set([...options, ...selected])];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-9 w-[150px] justify-between rounded-full text-sm font-normal ${enabled ? "border-primary text-primary" : "border-border/70"}`}
        >
          <span className="flex min-w-0 items-center gap-1 truncate">
            {icon}
            {label}
            {enabled ? ` · ${selected.length}` : ""}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange(e.target.checked ? [...options] : undefined)}
          />
          Activar filtro: {label}
        </label>
        {children}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onChange([...options])}>
            Todos
          </Button>
          <Button size="sm" variant="outline" onClick={() => onChange([])}>
            Ninguno
          </Button>
        </div>
        <div className="grid max-h-64 grid-cols-2 gap-1 overflow-auto">
          {shown.map((option) => (
            <label
              key={option}
              className={`flex min-w-0 cursor-pointer items-start gap-2 rounded p-2 text-xs ${selected.includes(option) ? "bg-primary/10" : "bg-muted/30"}`}
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...new Set([...selected, option])]
                      : selected.filter((item) => item !== option),
                  )
                }
              />
              <span className="break-words">{display(option)}</span>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Los valores marcados se combinan. Desactivar incluye todos; «Ninguno» muestra cero
          resultados.
        </p>
      </PopoverContent>
    </Popover>
  );
}
