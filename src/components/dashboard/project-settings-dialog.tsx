import { useEffect, useState } from "react";
import { Download, RotateCcw, Save, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeProjectConfig, type ProjectConfig } from "@/lib/project-config";
import type { ProjectFieldConfig } from "@/config/project.schema";

interface ProjectSettingsDialogProps {
  config: ProjectConfig;
  hasOverride: boolean;
  onSave: (config: ProjectConfig) => void;
  onRestoreDefaults: () => void;
  onExport: () => void;
}

const EDITABLE_FIELD_KEYS = [
  "zona",
  "nivel",
  "volumen",
  "edificio",
  "sector",
  "categoria",
  "contenedor",
] as const;

export function ProjectSettingsDialog({
  config,
  hasOverride,
  onSave,
  onRestoreDefaults,
  onExport,
}: ProjectSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProjectConfig>(config);

  useEffect(() => {
    if (open) setDraft(config);
  }, [config, open]);

  const updateField = (key: string, patch: Partial<ProjectFieldConfig>) => {
    setDraft((current) => ({
      ...current,
      fields: {
        ...current.fields,
        [key]: {
          ...current.fields[key],
          ...patch,
        },
      },
    }));
  };

  const save = () => {
    onSave(normalizeProjectConfig(draft));
    setOpen(false);
  };

  const restore = () => {
    onRestoreDefaults();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Configuracion del proyecto">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuracion del proyecto</DialogTitle>
          <DialogDescription>
            Los cambios se guardan como override local y se aplican al dashboard actual.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1fr_220px_220px]">
          <div className="space-y-2">
            <Label htmlFor="guid-field">Campo GUID</Label>
            <Input
              id="guid-field"
              value={draft.guidField}
              onChange={(event) => setDraft({ ...draft, guidField: event.target.value })}
              placeholder="guid"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="severity-alta">Umbral alta (m)</Label>
            <Input
              id="severity-alta"
              type="number"
              step="0.001"
              value={draft.severity.high}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  severity: {
                    ...draft.severity,
                    high: Number(event.target.value),
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="severity-media">Umbral media (m)</Label>
            <Input
              id="severity-media"
              type="number"
              step="0.001"
              value={draft.severity.medium}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  severity: {
                    ...draft.severity,
                    medium: Number(event.target.value),
                  },
                })
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="space-y-2">
            <Label htmlFor="priority-regex">Regex prioridad</Label>
            <Input
              id="priority-regex"
              value={draft.prioridad.regex}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  prioridad: {
                    ...draft.prioridad,
                    regex: event.target.value,
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority-group">Grupo prioridad</Label>
            <Input
              id="priority-group"
              type="number"
              min={1}
              value={draft.prioridad.group}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  prioridad: {
                    ...draft.prioridad,
                    group: Number(event.target.value),
                  },
                })
              }
            />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Campos del XML</h3>
          <div className="space-y-2">
            {EDITABLE_FIELD_KEYS.map((key) => {
              const field = draft.fields[key];
              if (!field) return null;
              return (
                <div
                  key={key}
                  className="grid gap-2 rounded-lg border bg-card p-3 md:grid-cols-[150px_180px_1fr]"
                >
                  <div className="space-y-1">
                    <Label>Key</Label>
                    <Input value={key} disabled />
                  </div>
                  <div className="space-y-1">
                    <Label>Label</Label>
                    <Input
                      value={field.label}
                      onChange={(event) => updateField(key, { label: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>sourceXmlTag</Label>
                    <Input
                      value={field.sourceXmlTag ?? ""}
                      onChange={(event) =>
                        updateField(key, { sourceXmlTag: event.target.value || null })
                      }
                      placeholder="Element Zona"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {hasOverride ? "Override local activo" : "Usando project.json por defecto"}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={restore}>
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar valores por defecto
            </Button>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-3.5 w-3.5" />
              Exportar configuracion
            </Button>
            <Button size="sm" onClick={save}>
              <Save className="h-3.5 w-3.5" />
              Guardar cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
