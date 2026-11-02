export interface SnapshotFolder {
  key: string;
  date: string;
  label: string;
  paths: string[];
}
export interface HistoryRange {
  start: string;
  end: string;
}
export function snapshotFromPath(path: string): Omit<SnapshotFolder, "paths"> | undefined {
  const match = path.replaceAll("\\", "/").match(/(?:^|\/)data\/(\d{6})\/[^/]+\.xml$/i);
  if (!match) return undefined;
  const folder = match[1],
    date = `20${folder.slice(0, 2)}-${folder.slice(2, 4)}-${folder.slice(4, 6)}`;
  const time = Date.parse(date + "T00:00:00Z");
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date)
    return undefined;
  return { key: folder, date, label: folder };
}
export function discoverSnapshotFolders(paths: string[]): SnapshotFolder[] {
  const folders = new Map<string, SnapshotFolder>();
  for (const path of paths) {
    const snapshot = snapshotFromPath(path);
    if (!snapshot) continue;
    const folder = folders.get(snapshot.key) ?? { ...snapshot, paths: [] };
    folder.paths.push(path);
    folders.set(snapshot.key, folder);
  }
  return [...folders.values()]
    .map((folder) => ({ ...folder, paths: folder.paths.sort() }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function foldersInRange(folders: SnapshotFolder[], range: HistoryRange | undefined) {
  if (!range || range.start > range.end) return [];
  return folders.filter((folder) => folder.date >= range.start && folder.date <= range.end);
}
