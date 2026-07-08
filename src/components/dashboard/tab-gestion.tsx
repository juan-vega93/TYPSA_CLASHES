import { memo, useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { Clash, ClashStatus } from "@/lib/clash-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Panel } from "./panel";
import type { ClashOverride } from "@/lib/use-clash-state";
import { useVirtualRows } from "./virtual-table";

const STATUS_OPTIONS: { value: ClashStatus; label: string }[] = [
  { value: "active", label: "Activo" },
  { value: "reviewed", label: "Revisado" },
  { value: "approved", label: "Aprobado" },
  { value: "resolved", label: "Resuelto" },
];

const SEV_STYLES: Record<string, string> = {
  alta: "bg-[color-mix(in_oklab,var(--sev-alta)_15%,transparent)] text-[var(--sev-alta)] border-[color-mix(in_oklab,var(--sev-alta)_40%,transparent)]",
  media:
    "bg-[color-mix(in_oklab,var(--sev-media)_18%,transparent)] text-[color-mix(in_oklab,var(--sev-media)_65%,black)] border-[color-mix(in_oklab,var(--sev-media)_40%,transparent)]",
  baja: "bg-[color-mix(in_oklab,var(--sev-baja)_15%,transparent)] text-[color-mix(in_oklab,var(--sev-baja)_60%,black)] border-[color-mix(in_oklab,var(--sev-baja)_40%,transparent)]",
};

function toCsv(rows: Clash[], overrides: Record<string, ClashOverride>): string {
  const headers = [
    "id",
    "clash",
    "test",
    "archivo",
    "estado",
    "asignado",
    "severidad",
    "penetracion_m",
    "zona",
    "nivel",
    "edificio",
    "sector",
    "creado",
    "resuelto_en",
    "item1_element_id",
    "item1_familia",
    "item1_categoria",
    "item2_element_id",
    "item2_familia",
    "item2_categoria",
    "nota",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const c of rows) {
    const o = overrides[c.id] ?? {};
    lines.push(
      [
        c.id,
        c.name,
        c.test,
        c.file,
        o.status ?? c.status,
        o.assignee ?? "",
        c.severity,
        c.distance.toFixed(4),
        c.zona ?? "",
        c.nivel ?? "",
        c.edificio ?? "",
        c.sector ?? "",
        c.createdAt,
        o.resolvedAt ?? "",
        c.items[0].elementId ?? "",
        c.items[0].family ?? "",
        c.items[0].category ?? "",
        c.items[1].elementId ?? "",
        c.items[1].family ?? "",
        c.items[1].category ?? "",
        o.note ?? "",
      ]
        .map(esc)
        .join(",")
    );
  }
  return lines.join("\n");
}

const GestionRow = memo(function GestionRow({
  clash,
  override,
  onUpdate,
}: {
  clash: Clash;
  override: ClashOverride | undefined;
  onUpdate: (id: string, patch: ClashOverride) => void;
}) {
  const effStatus: ClashStatus = override?.status ?? clash.status;

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2">
        <Select
          value={effStatus}
          onValueChange={(v) => onUpdate(clash.id, { status: v as ClashStatus })}
        >
          <SelectTrigger className="h-7 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Input
          defaultValue={override?.assignee ?? ""}
          placeholder="-"
          className="h-7 w-24 text-xs"
          onBlur={(e) => onUpdate(clash.id, { assignee: e.target.value })}
        />
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${SEV_STYLES[clash.severity]}`}
        >
          {clash.severity}
        </span>
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {clash.distance.toFixed(3)} m
      </td>
      <td className="max-w-[260px] truncate px-3 py-2 font-medium">{clash.name}</td>
      <td className="max-w-[180px] truncate px-3 py-2 text-muted-foreground">{clash.test}</td>
      <td className="max-w-[160px] truncate px-3 py-2 text-muted-foreground">{clash.zona ?? "-"}</td>
      <td className="px-3 py-2 text-muted-foreground">{clash.nivel ?? "-"}</td>
      <td className="px-3 py-2">
        <div className="text-[11px] font-mono text-muted-foreground">
          {clash.items[0].elementId ?? "sin ID"}
        </div>
        <div className="max-w-[220px] truncate text-[11px] text-foreground">
          {clash.items[0].family ?? "-"}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="text-[11px] font-mono text-muted-foreground">
          {clash.items[1].elementId ?? "sin ID"}
        </div>
        <div className="max-w-[220px] truncate text-[11px] text-foreground">
          {clash.items[1].family ?? "-"}
        </div>
      </td>
      <td className="px-3 py-2">
        <Input
          defaultValue={override?.note ?? ""}
          placeholder="Anadir nota..."
          className="h-7 w-40 text-xs"
          onBlur={(e) => onUpdate(clash.id, { note: e.target.value })}
        />
      </td>
    </tr>
  );
});

export function GestionTab({
  clashes,
  overrides,
  onUpdate,
}: {
  clashes: Clash[];
  overrides: Record<string, ClashOverride>;
  onUpdate: (id: string, patch: ClashOverride) => void;
}) {
  const [sortKey, setSortKey] = useState<"severity" | "distance" | "name">("distance");
  const rows = useMemo(() => {
    const arr = [...clashes];
    if (sortKey === "distance") arr.sort((a, b) => b.distance - a.distance);
    else if (sortKey === "severity")
      arr.sort((a, b) => {
        const w = { alta: 0, media: 1, baja: 2 } as const;
        return w[a.severity] - w[b.severity];
      });
    else arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [clashes, sortKey]);
  const { virtual, setScrollTop } = useVirtualRows({ rows, rowHeight: 48 });

  function exportCsv() {
    const csv = toCsv(clashes, overrides);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gestion_avance.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel
      title={`Gestion de avance - ${clashes.length} clashes`}
      subtitle={`Tabla virtualizada: ${virtual.rows.length} filas montadas de ${rows.length}.`}
      right={
        <div className="flex gap-2">
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="distance">Ordenar por penetracion</SelectItem>
              <SelectItem value="severity">Ordenar por severidad</SelectItem>
              <SelectItem value="name">Ordenar por nombre</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={exportCsv} className="gap-2">
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>
      }
    >
      <div className="overflow-x-auto rounded-lg border">
        <div className="max-h-[560px] overflow-y-auto" onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
          <table className="w-full min-w-[1200px] table-fixed text-xs">
            <thead className="sticky top-0 z-10 bg-muted/95 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-[130px] px-3 py-2 text-left font-medium">Estado</th>
                <th className="w-[120px] px-3 py-2 text-left font-medium">Asignado</th>
                <th className="w-[80px] px-3 py-2 text-left font-medium">Sev.</th>
                <th className="w-[110px] px-3 py-2 text-right font-medium">Penetracion</th>
                <th className="w-[260px] px-3 py-2 text-left font-medium">Clash</th>
                <th className="w-[180px] px-3 py-2 text-left font-medium">Test</th>
                <th className="w-[160px] px-3 py-2 text-left font-medium">Zona</th>
                <th className="w-[100px] px-3 py-2 text-left font-medium">Nivel</th>
                <th className="w-[220px] px-3 py-2 text-left font-medium">Item 1</th>
                <th className="w-[220px] px-3 py-2 text-left font-medium">Item 2</th>
                <th className="w-[180px] px-3 py-2 text-left font-medium">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {virtual.before > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={11} style={{ height: virtual.before, padding: 0 }} />
                </tr>
              )}
              {virtual.rows.map(({ row }) => (
                <GestionRow
                  key={row.id}
                  clash={row}
                  override={overrides[row.id]}
                  onUpdate={onUpdate}
                />
              ))}
              {virtual.after > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={11} style={{ height: virtual.after, padding: 0 }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}
