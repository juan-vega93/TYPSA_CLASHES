import { parseClashXml } from "./clash-parser";
import type { Clash } from "./clash-types";
import type { ProjectConfig } from "./project-config";
import { compactClash } from "./compact-clash";
import { fetchClashXml } from "./fetch-clash-xml";

export type ClashWorkerRequest = {
  id: number;
  config: ProjectConfig;
  compact?: boolean;
  files: {
    name: string;
    xml?: string;
    url?: string;
    snapshotKey?: string;
    snapshotDate?: string;
  }[];
};

export type ClashWorkerResponse = {
  id: number;
  clashes: Clash[];
  errors: { name: string; message: string }[];
};

self.onmessage = async (event: MessageEvent<ClashWorkerRequest>) => {
  const { id, files, config, compact } = event.data;
  const clashes: Clash[] = [];
  const errors: ClashWorkerResponse["errors"] = [];

  for (const file of files) {
    try {
      let xml = file.xml;
      if (xml === undefined && file.url) xml = await fetchClashXml(file.url);
      if (xml === undefined) throw Error("Falta el contenido XML");
      const parsed = parseClashXml(xml, file.name.replace(/\.xml$/i, ""), config);
      clashes.push(
        ...parsed.map((clash) => ({
          ...(compact ? compactClash(clash) : clash),
          snapshotKey: file.snapshotKey,
          snapshotDate: file.snapshotDate,
        })),
      );
    } catch (error) {
      errors.push({
        name: file.name,
        message: error instanceof Error ? error.message : "Parse failed",
      });
    }
  }

  self.postMessage({ id, clashes, errors } satisfies ClashWorkerResponse);
};
