import { useCallback, useEffect, useState } from "react";
import type { ClashStatus } from "./clash-types";

const KEY = "clash-control-state-v1";

export interface ClashOverride {
  status?: ClashStatus;
  note?: string;
  assignee?: string;
  resolvedAt?: string;
}

export interface ClashStateData {
  overrides: Record<string, ClashOverride>;
}

function load(): ClashStateData {
  if (typeof window === "undefined") return { overrides: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { overrides: {} };
    return JSON.parse(raw);
  } catch {
    return { overrides: {} };
  }
}

export function useClashState() {
  const [data, setData] = useState<ClashStateData>(() => load());

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(data));
  }, [data]);

  const update = useCallback((id: string, patch: ClashOverride) => {
    setData((prev) => {
      const cur = prev.overrides[id] ?? {};
      const merged = { ...cur, ...patch };
      if (patch.status && patch.status !== "active" && !merged.resolvedAt) {
        merged.resolvedAt = new Date().toISOString();
      }
      if (patch.status === "active") {
        delete merged.resolvedAt;
      }
      return { ...prev, overrides: { ...prev.overrides, [id]: merged } };
    });
  }, []);

  const reset = useCallback(() => setData({ overrides: {} }), []);

  return { data, update, reset };
}
