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
  sector?: string;
  ambiente?: string;
  codigoAmbiente?: string;
  especialidad?: string;
  idPartida?: string;
  container?: string;
  raw?: Record<string, string>;
}

export interface Clash {
  id: string;
  name: string;
  test: string;
  file: string;
  prioridad?: string;
  contenedor?: string;
  snapshotKey?: string;
  snapshotDate?: string;
  status: ClashStatus;
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
  sector?: string;
  ambiente?: string;
  categoriaPair?: string;
  familyPair?: string;
  typePair?: string;
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
  const d = Math.abs(distanceMeters);
  if (d >= 0.1) return "alta";
  if (d >= 0.01) return "media";
  return "baja";
}
