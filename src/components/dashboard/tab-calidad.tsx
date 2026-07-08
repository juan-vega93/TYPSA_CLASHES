import { useMemo } from "react";
import type { Clash } from "@/lib/clash-types";
import { Panel } from "./panel";

const FIELDS: { key: string; label: string; get: (c: Clash) => string | undefined }[] = [
  { key: "elementId", label: "Element ID real", get: (c) => c.items[0].elementId },
  { key: "sector", label: "Sector", get: (c) => c.sector },
  { key: "zona", label: "Zona", get: (c) => c.zona },
  { key: "edificio", label: "Edificio", get: (c) => c.edificio },
  { key: "ambiente", label: "Ambiente", get: (c) => c.ambiente },
  { key: "codigoAmbiente", label: "Código ambiente", get: (c) => c.items[0].codigoAmbiente },
  { key: "idPartida", label: "ID partida", get: (c) => c.items[0].idPartida },
  { key: "nivel", label: "Nivel", get: (c) => c.nivel },
  { key: "categoria", label: "Categoría", get: (c) => c.items[0].category },
];

export function CalidadTab({ clashes }: { clashes: Clash[] }) {
  const { rows, filesLog, kpi } = useMemo(() => {
    // objetos por par
    const objetos = clashes.length * 2;
    const withId = clashes.reduce(
      (s, c) =>
        s + (c.items[0].elementId ? 1 : 0) + (c.items[1].elementId ? 1 : 0),
      0
    );
    const withPartida = clashes.reduce((s, c) => s + (c.items[0].idPartida ? 1 : 0), 0);

    const rows = FIELDS.map((f) => {
      let missing = 0;
      for (const c of clashes) if (!f.get(c)) missing += 1;
      return { label: f.label, missing };
    }).sort((a, b) => b.missing - a.missing);

    const filesLog = Array.from(
      clashes.reduce((m, c) => {
        m.set(c.file, (m.get(c.file) ?? 0) + 1);
        return m;
      }, new Map<string, number>())
    );

    return {
      rows,
      filesLog,
      kpi: { objetos, withId, sinId: objetos - withId, withPartida },
    };
  }, [clashes]);

  const max = rows[0]?.missing ?? 0;

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetaCard label="Objetos" value={kpi.objetos} hint="2 por clash" />
        <MetaCard label="Con Element ID" value={kpi.withId} hint={`${pct(kpi.withId, kpi.objetos)}%`} />
        <MetaCard label="Sin Element ID" value={kpi.sinId} hint="No identificables en Revit" />
        <MetaCard label="Con ID partida" value={kpi.withPartida} hint="Vinculados a partida" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Campos incompletos" subtitle="Nº de clashes con el campo vacío">
          <div className="space-y-3">
            {rows.map((r) => {
              const w = max === 0 ? 0 : (r.missing / max) * 100;
              return (
                <div key={r.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{r.label}</span>
                    <span className="font-semibold tabular-nums">{r.missing}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Diagnóstico de carga">
          <div className="rounded-md border bg-muted/40 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
            {filesLog.length === 0 ? (
              "Sin archivos cargados."
            ) : (
              filesLog.map(([name, n]) => (
                <div key={name}>
                  <span className="text-foreground">{name}.xml</span>: {n} clashes
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

function MetaCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}