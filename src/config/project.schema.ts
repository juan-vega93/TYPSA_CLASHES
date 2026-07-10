export type ProjectFieldType = "string" | "status" | "severity" | "pair" | "derived";

export interface ProjectFieldConfig {
  label: string;
  sourceXmlTag: string | null;
  type: ProjectFieldType;
  filterable: boolean;
}

export interface SeverityThresholdConfig {
  high: number;
  medium: number;
}

export interface PriorityConfig {
  source: "testNameAndFileName" | "containerName";
  regex: string;
  group: number;
  uppercase: boolean;
}

export interface ProjectConfig {
  fields: Record<string, ProjectFieldConfig>;
  severity: SeverityThresholdConfig;
  guidField: string;
  prioridad: PriorityConfig;
}
