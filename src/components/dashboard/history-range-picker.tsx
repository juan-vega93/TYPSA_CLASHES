import { useState } from "react";
import type { HistoryRange, SnapshotFolder } from "@/lib/snapshot-folders";
import { foldersInRange } from "@/lib/snapshot-folders";
import { Panel } from "./panel";
import { Button } from "@/components/ui/button";
export function HistoryRangePicker({
  cuts,
  range,
  onGenerate,
  loading,
  progress,
}: {
  cuts: SnapshotFolder[];
  range?: HistoryRange;
  onGenerate: (range: HistoryRange) => void;
  loading: boolean;
  progress: { done: number; total: number };
}) {
  const [start, setStart] = useState(range?.start ?? cuts.at(-2)?.date ?? cuts[0]?.date ?? ""),
    [end, setEnd] = useState(range?.end ?? cuts.at(-1)?.date ?? "");
  const selected = foldersInRange(cuts, { start, end });
  const invalid = !start || !end || start > end || !selected.length;
  return (
    <Panel
      title="Período de análisis"
      subtitle="Solo se consideran XML directamente dentro de carpetas AAMMDD con fecha válida. Los archivos sueltos, respaldos y subcarpetas auxiliares se ignoran."
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          Inicio
          <select
            className="rounded border bg-background p-2"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          >
            {cuts.map((c) => (
              <option key={c.key} value={c.date}>
                {c.date} · {c.key}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Fin
          <select
            className="rounded border bg-background p-2"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          >
            {cuts.map((c) => (
              <option key={c.key} value={c.date}>
                {c.date} · {c.key}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={invalid} onClick={() => onGenerate({ start, end })}>
          Generar período
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setStart(cuts[0]?.date ?? "");
            setEnd(cuts.at(-1)?.date ?? "");
          }}
        >
          Seleccionar todos los cortes
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {invalid
          ? "Selecciona un inicio anterior o igual al fin."
          : `${selected.length} cortes · ${selected.reduce((n, c) => n + c.paths.length, 0)} XML en el período elegido. Se cargan al pulsar Generar período; el resto no se analiza.`}
      </p>
      {range && (
        <p className="mt-2 text-xs font-medium">
          Período solicitado: {range.start} → {range.end}
          {loading ? ` · preparando ${progress.done} / ${progress.total} XML` : " · listo"}
        </p>
      )}
    </Panel>
  );
}
