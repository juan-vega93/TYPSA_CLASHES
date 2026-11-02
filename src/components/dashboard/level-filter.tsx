import { Building2 } from "lucide-react";
import { MISSING_LEVEL, type FilterState, type LevelSource } from "@/lib/clash-query";
import { CheckboxFilter } from "./checkbox-filter";
export function LevelFilter({
  value,
  options,
  onChange,
  label,
}: {
  value: FilterState;
  options: Record<LevelSource, string[]>;
  onChange: (value: FilterState) => void;
  label: string;
}) {
  const source = value.nivelSource ?? "either";
  return (
    <CheckboxFilter
      label={label}
      options={options[source]}
      value={value.nivel}
      onChange={(nivel) => onChange({ ...value, nivel })}
      icon={<Building2 className="h-4 w-4 shrink-0" />}
      display={(level) => (level === MISSING_LEVEL ? "Sin nivel exportado" : level)}
    >
      <label className="grid gap-1 text-xs">
        Tomar nivel de
        <select
          className="rounded border bg-background p-2"
          value={source}
          onChange={(e) => onChange({ ...value, nivelSource: e.target.value as LevelSource })}
        >
          <option value="either">Cualquiera de los dos objetos</option>
          <option value="a">Objeto A</option>
          <option value="b">Objeto B</option>
          <option value="primary">Nivel principal</option>
        </select>
      </label>
    </CheckboxFilter>
  );
}
