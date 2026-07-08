import { parseClashXml } from "./clash-parser";
import type { Clash } from "./clash-types";

export type ClashWorkerRequest = {
  id: number;
  files: { name: string; xml: string; snapshotKey?: string; snapshotDate?: string }[];
};

export type ClashWorkerResponse = {
  id: number;
  clashes: Clash[];
  errors: { name: string; message: string }[];
};

self.onmessage = (event: MessageEvent<ClashWorkerRequest>) => {
  const { id, files } = event.data;
  const clashes: Clash[] = [];
  const errors: ClashWorkerResponse["errors"] = [];

  for (const file of files) {
    try {
      const parsed = parseClashXml(file.xml, file.name.replace(/\.xml$/i, ""));
      clashes.push(
        ...parsed.map((clash) => ({
          ...clash,
          snapshotKey: file.snapshotKey,
          snapshotDate: file.snapshotDate,
        }))
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
