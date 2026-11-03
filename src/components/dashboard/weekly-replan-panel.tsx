import { useState } from "react";
import { Panel } from "./panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadFile } from "@/lib/plan-export";
import { weeklyReplanErrors, weeklyReplanSchedule, type WeeklyReplan } from "@/lib/weekly-replan";

const n = (value: number) => value.toLocaleString("es-PE");
export function WeeklyReplanPanel({
  versions,
  selected,
  anchor,
  endDate,
  onSelect,
  onCreate,
  onUpdate,
  onManual,
  onRestore,
}: {
  versions: WeeklyReplan[];
  selected?: WeeklyReplan;
  anchor: { date: string; closed: number; pending: number };
  endDate: string;
  onSelect: (id: string) => void;
  onCreate: (end: string, distribute: boolean) => void;
  onUpdate: (version: WeeklyReplan) => void;
  onManual: () => void;
  onRestore: (file: File) => void;
}) {
  const [end, setEnd] = useState(endDate);
  const [distribute, setDistribute] = useState(true);
  const rows = selected ? weeklyReplanSchedule(selected) : [];
  const assigned = rows.reduce((sum, row) => sum + row.weekly, 0);
  return (
    <Panel
      title="Programar el pendiente desde el corte actual"
      subtitle={`XML al ${anchor.date}: ${n(anchor.closed)} cierres acumulados y ${n(anchor.pending)} pendientes. La nueva programación parte de ese avance, sin reiniciar en cero.`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          Fecha objetivo
          <Input
            type="date"
            value={end}
            min={anchor.date}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 p-2 text-sm">
          <input
            type="checkbox"
            checked={distribute}
            onChange={(event) => setDistribute(event.target.checked)}
          />
          Reparto uniforme inicial, editable
        </label>
        <Button
          disabled={!anchor.pending || end <= anchor.date}
          onClick={() => onCreate(end, distribute)}
        >
          Reprogramar desde {anchor.date}
        </Button>
      </div>
      <div className="my-4 flex flex-wrap items-center gap-3">
        <label className="grid gap-1 text-sm">
          Programación a mostrar
          <select
            className="max-w-lg rounded border bg-background p-2"
            value={selected?.id ?? "none"}
            onChange={(event) => onSelect(event.target.value)}
          >
            <option value="none">Solo referencia original, sin reprogramación</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                Desde {version.anchorDate} · {n(version.pending)} pendientes ·{" "}
                {version.createdAt.slice(0, 19).replace("T", " ")}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          disabled={!versions.length}
          onClick={() =>
            downloadFile(
              "programaciones-semanales.json",
              JSON.stringify(versions, null, 2),
              "application/json",
            )
          }
        >
          Respaldar programaciones JSON
        </Button>
        <label className="cursor-pointer rounded border p-2 text-sm">
          Recuperar respaldo
          <input
            className="hidden"
            type="file"
            accept=".json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onRestore(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {selected && (
        <>
          {selected.anchorDate !== anchor.date && (
            <p className="mb-3 text-sm text-amber-800">
              Esta versión conserva el corte {selected.anchorDate}. Hay un corte más reciente (
              {anchor.date}); crea otra versión si quieres incorporar su pendiente.
            </p>
          )}
          <p className="mb-3 text-sm">
            <strong>Arranque: {n(selected.anchorClosed)} cerrados.</strong> Metas futuras:{" "}
            {n(assigned)} de {n(selected.pending)} pendientes asignados. Acumulado objetivo final:{" "}
            {n(selected.anchorClosed + assigned)}.
          </p>
          {weeklyReplanErrors(selected).map((message) => (
            <p key={message} role="alert" className="mb-2 text-sm text-amber-800">
              {message}
            </p>
          ))}
          <div className="overflow-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Control</th>
                  <th>Meta del período · editable</th>
                  <th>Acumulado objetivo</th>
                  <th>Acumulado resuelto real</th>
                  <th>Fuente / desviación</th>
                </tr>
              </thead>
              <tbody>
                {selected.history.map((row) => (
                  <tr key={row.date} className="border-b bg-muted/20">
                    <td className="p-2">{row.date}</td>
                    <td>Historial</td>
                    <td>{row.date === selected.anchorDate ? n(row.closed) : "—"}</td>
                    <td>{n(row.closed)}</td>
                    <td>XML · solo lectura</td>
                  </tr>
                ))}
                {rows.map((row) => (
                  <tr key={row.date} className="border-b">
                    <td className="p-2">{row.date}</td>
                    <td>
                      <Input
                        aria-label={`Meta futura ${row.date}`}
                        className="my-1 w-28"
                        type="number"
                        min={0}
                        step={1}
                        value={row.weekly}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (Number.isSafeInteger(value) && value >= 0)
                            onUpdate({
                              ...selected,
                              goals: { ...selected.goals, [row.date]: value },
                            });
                        }}
                      />
                    </td>
                    <td>{n(row.target)}</td>
                    <td>
                      <Input
                        aria-label={`Avance futuro ${row.date}`}
                        className="my-1 w-36"
                        type="number"
                        min={selected.anchorClosed}
                        max={selected.anchorClosed + selected.pending}
                        step={1}
                        placeholder="Sin registrar"
                        value={row.actual ?? ""}
                        onChange={(event) => {
                          const text = event.target.value,
                            value = Number(text);
                          if (text !== "" && (!Number.isSafeInteger(value) || value < 0)) return;
                          const actuals = { ...selected.actuals };
                          if (text === "") delete actuals[row.date];
                          else actuals[row.date] = value;
                          onManual();
                          onUpdate({ ...selected, actuals });
                        }}
                      />
                    </td>
                    <td>
                      {row.deviation === null
                        ? "Manual · sin registro"
                        : `Manual · ${n(row.deviation)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            El objetivo suma las metas futuras a los cierres del corte. No es avance resuelto: ese
            dato se registra aparte como acumulado, sin volver a cero. No se suponen nuevas entradas
            futuras. Se guarda automáticamente en este navegador; respalda las programaciones para
            otro equipo.
          </p>
        </>
      )}
    </Panel>
  );
}
