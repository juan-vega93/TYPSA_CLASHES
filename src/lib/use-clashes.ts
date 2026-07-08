import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Clash, ClashSnapshot } from "./clash-types";
import type { ClashWorkerRequest, ClashWorkerResponse } from "./clash-worker";

// Recursive glob: supports both the old flat src/data/*.xml layout and the new
// dated src/data/YYMMDD/*.xml snapshot layout.
const modules = import.meta.glob("../data/**/*.xml", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

type XmlInput = {
  name: string;
  xml: string;
  snapshotKey?: string;
  snapshotDate?: string;
};

function baseName(p: string) {
  const seg = p.split("/").pop() || p;
  return seg.replace(/\.xml$/i, "");
}

function snapshotFromPath(path: string) {
  const parts = path.split(/[\\/]/);
  const folder = parts[parts.length - 2] ?? "";
  const match = folder.match(/^(\d{2})(\d{2})(\d{2})$/) ?? folder.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) {
    const today = new Date().toISOString().slice(0, 10);
    return { key: "actual", date: today, label: "Actual" };
  }

  const year = match[1].length === 2 ? `20${match[1]}` : match[1];
  const month = match[2];
  const day = match[3];
  return { key: folder, date: `${year}-${month}-${day}`, label: folder };
}

function buildSnapshots(clashes: Clash[]): ClashSnapshot[] {
  const grouped = new Map<string, ClashSnapshot>();
  for (const clash of clashes) {
    const date = clash.snapshotDate ?? new Date().toISOString().slice(0, 10);
    const key = clash.snapshotKey ?? "actual";
    const existing = grouped.get(key);
    if (existing) existing.clashes.push(clash);
    else grouped.set(key, { key, date, label: key, clashes: [clash] });
  }
  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function dedupeById(clashes: Clash[]) {
  const byId = new Map<string, Clash>();
  for (const clash of clashes) byId.set(clash.id, clash);
  return Array.from(byId.values());
}

export function useClashes() {
  const [baseSnapshots, setBaseSnapshots] = useState<ClashSnapshot[]>([]);
  const [extra, setExtra] = useState<Clash[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const parseInWorker = useCallback((files: XmlInput[]) => {
    if (files.length === 0) return Promise.resolve({ clashes: [], errors: [] });

    if (typeof Worker === "undefined") {
      return import("./clash-parser").then(({ parseClashXml }) => {
        const clashes: Clash[] = [];
        const parseErrors: { name: string; message: string }[] = [];
        for (const file of files) {
          try {
            clashes.push(
              ...parseClashXml(file.xml, file.name).map((clash) => ({
                ...clash,
                snapshotKey: file.snapshotKey,
                snapshotDate: file.snapshotDate,
              }))
            );
          } catch (error) {
            parseErrors.push({
              name: file.name,
              message: error instanceof Error ? error.message : "Parse failed",
            });
          }
        }
        return { clashes, errors: parseErrors };
      });
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("./clash-worker.ts", import.meta.url), {
        type: "module",
      });
    }

    const worker = workerRef.current;
    const id = requestIdRef.current + 1;
    requestIdRef.current = id;

    return new Promise<{ clashes: Clash[]; errors: { name: string; message: string }[] }>(
      (resolve) => {
        const onMessage = (event: MessageEvent<ClashWorkerResponse>) => {
          if (event.data.id !== id) return;
          worker.removeEventListener("message", onMessage);
          resolve({ clashes: event.data.clashes, errors: event.data.errors });
        };
        worker.addEventListener("message", onMessage);
        worker.postMessage({ id, files } satisfies ClashWorkerRequest);
      }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBase() {
      setIsLoading(true);
      setIsParsing(true);
      const files = await Promise.all(
        Object.entries(modules).map(async ([path, load]) => {
          const snapshot = snapshotFromPath(path);
          return {
            name: baseName(path),
            xml: await load(),
            snapshotKey: snapshot.key,
            snapshotDate: snapshot.date,
          };
        })
      );
      const result = await parseInWorker(files);
      if (cancelled) return;
      setBaseSnapshots(buildSnapshots(result.clashes));
      setErrors(result.errors);
      setIsLoading(false);
      setIsParsing(false);
    }

    loadBase().catch((error) => {
      if (cancelled) return;
      setErrors([{ name: "src/data", message: error instanceof Error ? error.message : "Load failed" }]);
      setIsLoading(false);
      setIsParsing(false);
    });

    return () => {
      cancelled = true;
    };
  }, [parseInWorker]);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  async function ingestFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const today = new Date().toISOString().slice(0, 10);
    setIsParsing(true);
    const loaded = await Promise.all(
      arr.map(async (f) => ({
        name: f.name.replace(/\.xml$/i, ""),
        xml: await f.text(),
        snapshotKey: "upload",
        snapshotDate: today,
      }))
    );
    const result = await parseInWorker(loaded);
    setErrors((prev) => [...prev, ...result.errors]);
    setExtra((prev) => {
      const latestBase = baseSnapshots[baseSnapshots.length - 1]?.clashes ?? [];
      const seen = new Set(prev.map((c) => c.id).concat(latestBase.map((c) => c.id)));
      return [...prev, ...result.clashes.filter((c) => !seen.has(c.id))];
    });
    setIsParsing(false);
  }

  function clearExtras() {
    setExtra([]);
  }

  const latestBase = baseSnapshots[baseSnapshots.length - 1]?.clashes ?? [];
  const clashes = useMemo(() => dedupeById([...latestBase, ...extra]), [latestBase, extra]);
  const snapshots = useMemo<ClashSnapshot[]>(() => {
    if (extra.length === 0) return baseSnapshots;
    const uploadSnapshot: ClashSnapshot = {
      key: "upload",
      date: new Date().toISOString().slice(0, 10),
      label: "Upload",
      clashes: dedupeById([...latestBase, ...extra]),
    };
    return [...baseSnapshots, uploadSnapshot].sort((a, b) => a.date.localeCompare(b.date));
  }, [baseSnapshots, extra, latestBase]);

  return {
    clashes,
    snapshots,
    ingestFiles,
    clearExtras,
    hasExtras: extra.length > 0,
    isLoading,
    isParsing,
    errors,
  };
}
