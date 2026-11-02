import type { Clash } from "./clash-types";

// A complete test report replaces that test, including clashes removed by Navisworks.
export function mergeTestUpdates(base: Clash[], updates: Clash[]): Clash[] {
  const tests = new Set(updates.map((clash) => clash.test));
  const byId = new Map<string, Clash>();
  for (const clash of base) if (!tests.has(clash.test)) byId.set(clash.id, clash);
  for (const clash of updates) byId.set(clash.id, clash);
  return [...byId.values()];
}
