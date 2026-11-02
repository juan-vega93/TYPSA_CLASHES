import { DEFAULT_PROJECT_CONFIG, severityForConfig } from "./project-config";

export type Severity = "alta" | "media" | "baja";
export type ClashStatus = "active" | "reviewed" | "approved" | "resolved";

export interface ClashItem {
  elementId?: string;
  category?: string;
  family?: string;
  type?: string;
  edificio?: string;
  zona?: string;
  nivel?: string;
  nivelSource?: "property" | "reference" | "layer";
  nivelRaw?: string;
  volumen?: string;
  sector?: string;
  ambiente?: string;
  codigoAmbiente?: string;
  especialidad?: string;
  idPartida?: string;
  container?: string;
  filterValues?: Record<string, string>;
  raw?: Record<string, string>;
}

export interface Clash {
  /** Precomputed only for compact historical records. */
  searchText?: string;
  id: string;
  kind?: "clash" | "group";
  name: string;
  test: string;
  file: string;
  prioridad?: string;
  contenedor?: string;
  snapshotKey?: string;
  snapshotDate?: string;
  status: ClashStatus;
  sourceStatus?: string;
  testType?: string;
  testTolerance?: number;
  distance: number; // penetration in meters (absolute)
  signedDistance: number;
  severity: Severity;
  pos: { x: number; y: number; z: number };
  gridlocation?: string;
  createdAt: string; // ISO
  items: [ClashItem, ClashItem];
  // derived merged tags
  zona?: string;
  nivel?: string;
  edificio?: string;
  volumen?: string;
  sector?: string;
  ambiente?: string;
  categoriaPair?: string;
  familyPair?: string;
  typePair?: string;
  filterValues?: Record<string, string>;
}

export interface ClashFile {
  name: string;
  content: string;
}

export interface ClashSnapshot {
  key: string;
  date: string;
  label: string;
  clashes: Clash[];
}

export function severityFor(distanceMeters: number): Severity {
  return severityForConfig(distanceMeters, DEFAULT_PROJECT_CONFIG);
}
