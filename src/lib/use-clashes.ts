import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Clash, ClashSnapshot } from "./clash-types";
import type { ClashWorkerRequest, ClashWorkerResponse } from "./clash-worker";
import type { ProjectConfig } from "./project-config";
import { mergeTestUpdates } from "./clash-updates";
import { compactClash } from "./compact-clash";
import { fetchClashXml } from "./fetch-clash-xml";
import {
  discoverSnapshotFolders,
  foldersInRange,
  snapshotFromPath,
  type HistoryRange,
} from "./snapshot-folders";
// Direct dated folders only. URL assets avoid evaluating and retaining XML as JavaScript strings.
const modules = import.meta.glob("../data/[0-9][0-9][0-9][0-9][0-9][0-9]/*.xml", {
  query: "?url&no-inline",
  import: "default",
}) as Record<string, () => Promise<string>>;
const availableCuts = discoverSnapshotFolders(Object.keys(modules));
type XmlInput = ClashWorkerRequest["files"][number];
type ParseResult = Pick<ClashWorkerResponse, "clashes" | "errors">;
const baseName = (path: string) => (path.split("/").pop() ?? path).replace(/\.xml$/i, "");
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function useClashes(config: ProjectConfig, historyRange?: HistoryRange) {
  const [baseSnapshots, setBaseSnapshots] = useState<ClashSnapshot[]>([]),
    [historySnapshots, setHistorySnapshots] = useState<ClashSnapshot[]>([]),
    [extra, setExtra] = useState<Clash[]>([]);
  const [isLoading, setIsLoading] = useState(true),
    [isParsing, setIsParsing] = useState(false),
    [isHistoryLoading, setIsHistoryLoading] = useState(false),
    [historyProgress, setHistoryProgress] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState<ParseResult["errors"]>([]),
    [historyErrors, setHistoryErrors] = useState<ParseResult["errors"]>([]);
  const [loadedHistory, setLoadedHistory] = useState<{
    range: string;
    config: ProjectConfig;
  } | null>(null);
  const workerRef = useRef<Worker | null>(null),
    requestIdRef = useRef(0);
  const cacheRef = useRef<{
    config: ProjectConfig;
    full: Map<string, Promise<ParseResult>>;
    compact: Map<string, Promise<ParseResult>>;
  }>({ config, full: new Map(), compact: new Map() });
  const parseInWorker = useCallback(
    async (files: XmlInput[], compact = false): Promise<ParseResult> => {
      if (!files.length) return { clashes: [], errors: [] };
      if (typeof Worker === "undefined") {
        const { parseClashXml } = await import("./clash-parser");
        const result: ParseResult = { clashes: [], errors: [] };
        for (const file of files)
          try {
            let xml = file.xml;
            if (xml === undefined && file.url) xml = await fetchClashXml(file.url);
            if (xml === undefined) throw Error("Falta el contenido XML");
            result.clashes.push(
              ...parseClashXml(xml, file.name, config).map((c) => ({
                ...(compact ? compactClash(c) : c),
                snapshotKey: file.snapshotKey,
                snapshotDate: file.snapshotDate,
              })),
            );
          } catch (reason) {
            result.errors.push({
              name: file.name,
              message: reason instanceof Error ? reason.message : "Parse failed",
            });
          }
        return result;
      }
      if (!workerRef.current)
        workerRef.current = new Worker(new URL("./clash-worker.ts", import.meta.url), {
          type: "module",
        });
      const worker = workerRef.current,
        id = ++requestIdRef.current;
      return new Promise((resolve, reject) => {
        const cleanup = () => {
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
        };
        const onError = (event: ErrorEvent) => {
          cleanup();
          reject(Error(event.message || "No se pudo procesar el XML"));
        };
        const onMessage = (event: MessageEvent<ClashWorkerResponse>) => {
          if (event.data.id !== id) return;
          cleanup();
          resolve({ clashes: event.data.clashes, errors: event.data.errors });
        };
        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", onError);
        worker.postMessage({ id, files, config, compact } satisfies ClashWorkerRequest);
      });
    },
    [config],
  );
  const loadPath = useCallback(
    (path: string, compact: boolean) => {
      if (cacheRef.current.config !== config)
        cacheRef.current = { config, full: new Map(), compact: new Map() };
      const cache = cacheRef.current;
      const target = compact ? cache.compact : cache.full;
      const cached = target.get(path);
      if (cached) return cached;
      // The current cut already exists for detail tabs: share it instead of cloning it again.
      const current = compact ? cache.full.get(path) : undefined;
      const promise =
        current ??
        (async () => {
          const url = await modules[path]();
          const snapshot = snapshotFromPath(path)!;
          return parseInWorker(
            [
              {
                name: baseName(path),
                url,
                ...{ snapshotKey: snapshot.key, snapshotDate: snapshot.date },
              },
            ],
            compact,
          );
        })();
      target.set(path, promise);
      const discard = () => {
        if (target.get(path) === promise) target.delete(path);
      };
      void promise.then((result) => {
        if (result.errors.length) discard();
      }, discard);
      return promise;
    },
    [config, parseInWorker],
  );
  const latest = availableCuts.at(-1);
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsParsing(true);
    (async () => {
      const rows: Clash[] = [];
      const problems: ParseResult["errors"] = [];
      for (const path of latest?.paths ?? []) {
        if (cancelled) return;
        const result = await loadPath(path, false);
        if (cancelled) return;
        rows.push(...result.clashes);
        problems.push(...result.errors);
      }
      if (cancelled) return;
      setBaseSnapshots(
        latest ? [{ key: latest.key, date: latest.date, label: latest.label, clashes: rows }] : [],
      );
      setErrors(problems);
      setIsLoading(false);
      setIsParsing(false);
    })().catch((reason) => {
      if (cancelled) return;
      setErrors([{ name: "src/data", message: String(reason) }]);
      setIsLoading(false);
      setIsParsing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadPath, latest]);
  const rangeStart = historyRange?.start,
    rangeEnd = historyRange?.end;
  useEffect(() => {
    let cancelled = false;
    if (!rangeStart || !rangeEnd) {
      setIsHistoryLoading(false);
      setHistorySnapshots([]);
      setHistoryErrors([]);
      setLoadedHistory(null);
      return;
    }
    const cuts = foldersInRange(availableCuts, { start: rangeStart, end: rangeEnd });
    // Retain only the requested history window; full current-cut rows remain shared.
    const neededPaths = new Set(cuts.flatMap((cut) => cut.paths));
    for (const path of cacheRef.current.compact.keys())
      if (!neededPaths.has(path)) cacheRef.current.compact.delete(path);
    const total = cuts.reduce((sum, c) => sum + c.paths.length, 0);
    setIsHistoryLoading(true);
    setHistoryProgress({ done: 0, total });
    setHistorySnapshots([]);
    setHistoryErrors([]);
    (async () => {
      const result: ClashSnapshot[] = [];
      const problems: ParseResult["errors"] = [];
      let done = 0;
      for (const cut of cuts) {
        const rows: Clash[] = [];
        for (const path of cut.paths) {
          if (cancelled) return;
          const parsed = await loadPath(path, true);
          if (cancelled) return;
          rows.push(...parsed.clashes);
          problems.push(...parsed.errors);
          setHistoryProgress({ done: ++done, total });
        }
        result.push({ key: cut.key, date: cut.date, label: cut.label, clashes: rows });
      }
      if (cancelled) return;
      setHistorySnapshots(result);
      setHistoryErrors(problems);
      setLoadedHistory({ range: `${rangeStart}/${rangeEnd}`, config });
      setIsHistoryLoading(false);
    })().catch((reason) => {
      if (cancelled) return;
      setHistoryErrors([{ name: "Históricos", message: String(reason) }]);
      setLoadedHistory({ range: `${rangeStart}/${rangeEnd}`, config });
      setIsHistoryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadPath, rangeStart, rangeEnd, config, historyRange]);
  useEffect(() => () => workerRef.current?.terminate(), []);
  async function ingestFiles(files: FileList | File[]) {
    setIsParsing(true);
    try {
      const loaded = await Promise.all(
        Array.from(files).map(async (file) => ({
          name: file.name.replace(/\.xml$/i, ""),
          xml: await file.text(),
          snapshotKey: "upload",
          snapshotDate: today(),
        })),
      );
      const result = await parseInWorker(loaded);
      setErrors((prev) => [...prev, ...result.errors]);
      setExtra((prev) => mergeTestUpdates(prev, result.clashes));
    } finally {
      setIsParsing(false);
    }
  }
  const latestBase = baseSnapshots[0]?.clashes;
  const clashes = useMemo(() => mergeTestUpdates(latestBase ?? [], extra), [latestBase, extra]);
  const snapshots = useMemo(
    () =>
      extra.length
        ? [...baseSnapshots, { key: "upload", date: today(), label: "Upload", clashes }]
        : baseSnapshots,
    [baseSnapshots, extra.length, clashes],
  );
  return {
    clashes,
    snapshots,
    historySnapshots:
      loadedHistory?.range === `${rangeStart}/${rangeEnd}` && loadedHistory.config === config
        ? historySnapshots
        : [],
    historyErrors,
    availableCuts,
    isHistoryLoading:
      Boolean(historyRange) &&
      (isHistoryLoading ||
        loadedHistory?.range !== `${rangeStart}/${rangeEnd}` ||
        loadedHistory.config !== config),
    historyProgress,
    ingestFiles,
    clearExtras: () => setExtra([]),
    hasExtras: extra.length > 0,
    isLoading,
    isParsing,
    errors: useMemo(() => [...errors, ...historyErrors], [errors, historyErrors]),
  };
}
