import { useCallback, useEffect, useMemo, useState } from "react";
import projectJson from "@/config/project.json";
import type {
  PriorityConfig,
  ProjectConfig,
  ProjectFieldConfig,
  SeverityThresholdConfig,
} from "@/config/project.schema";
import type { Severity } from "./clash-types";

export type { PriorityConfig, ProjectConfig, ProjectFieldConfig, SeverityThresholdConfig };

export interface RuntimeProjectFieldConfig extends ProjectFieldConfig {
  key: string;
  sourceXmlTag: string;
}

const STORAGE_KEY = "typsa.projectConfigOverride.v1";

function safeString(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function safeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeField(key: string, value: unknown): ProjectFieldConfig {
  const candidate = value as Partial<ProjectFieldConfig> | undefined;
  return {
    label: safeString(candidate?.label, key),
    sourceXmlTag:
      typeof candidate?.sourceXmlTag === "string" && candidate.sourceXmlTag.trim()
        ? candidate.sourceXmlTag.trim()
        : null,
    type: candidate?.type ?? "string",
    filterable: safeBoolean(candidate?.filterable, false),
  };
}

function normalizeSeverity(value: unknown): SeverityThresholdConfig {
  const candidate = value as Partial<SeverityThresholdConfig> | undefined;
  return {
    high: Number(candidate?.high ?? 0.1) || 0.1,
    medium: Number(candidate?.medium ?? 0.01) || 0.01,
  };
}

function normalizePriority(value: unknown): PriorityConfig {
  const candidate = value as Partial<PriorityConfig> | undefined;
  return {
    source: candidate?.source === "containerName" ? "containerName" : "testNameAndFileName",
    regex: safeString(candidate?.regex, "\\b(P\\d+)(?:[_-]|\\b)"),
    group: Number(candidate?.group ?? 1) || 1,
    uppercase: safeBoolean(candidate?.uppercase, true),
  };
}

export function normalizeProjectConfig(value: unknown): ProjectConfig {
  const candidate = value as Partial<ProjectConfig> | undefined;
  const fields = candidate?.fields && typeof candidate.fields === "object" ? candidate.fields : {};

  return {
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [key, normalizeField(key, field)]),
    ),
    severity: normalizeSeverity(candidate?.severity),
    guidField: safeString(candidate?.guidField, "guid"),
    prioridad: normalizePriority(candidate?.prioridad),
  };
}

export const DEFAULT_PROJECT_CONFIG = normalizeProjectConfig(projectJson);

export function getProjectField(config: ProjectConfig, key: string): ProjectFieldConfig {
  const field = config.fields[key];
  if (!field) throw new Error(`Missing project field config: ${key}`);
  return field;
}

export function getProjectFieldTag(config: ProjectConfig, key: string): string {
  const tag = getProjectField(config, key).sourceXmlTag;
  if (!tag) throw new Error(`Project field has no XML tag: ${key}`);
  return tag;
}

export function getRuntimeFilterFields(config: ProjectConfig): RuntimeProjectFieldConfig[] {
  const visibleProjectFieldKeys = ["zona", "nivel", "edificio", "sector", "contenedor"];
  return visibleProjectFieldKeys
    .map((key) => {
      const field = config.fields[key];
      if (!field?.filterable || !field.sourceXmlTag) return null;
      return { ...field, key, sourceXmlTag: field.sourceXmlTag };
    })
    .filter((field): field is RuntimeProjectFieldConfig => field != null);
}

function readOverride() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeProjectConfig(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function useProjectConfig() {
  const [override, setOverride] = useState<ProjectConfig | null>(() => readOverride());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setOverride(readOverride());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const config = useMemo(
    () => normalizeProjectConfig(override ?? DEFAULT_PROJECT_CONFIG),
    [override],
  );

  const saveConfig = useCallback((next: ProjectConfig) => {
    const normalized = normalizeProjectConfig(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    setOverride(normalized);
  }, []);

  const restoreDefaults = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setOverride(null);
  }, []);

  const exportConfig = useCallback(() => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "project.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [config]);

  return {
    config,
    hasOverride: override != null,
    saveConfig,
    restoreDefaults,
    exportConfig,
  };
}

export function severityForConfig(distanceMeters: number, config: ProjectConfig): Severity {
  const d = Math.abs(distanceMeters);
  if (d >= config.severity.high) return "alta";
  if (d >= config.severity.medium) return "media";
  return "baja";
}
