import assert from "node:assert/strict";
import { buildResolutionPlan } from "../src/lib/resolution-plan.ts";

for (const [pending, exceptions] of [
  [14164, 0],
  [14164, 1000],
  [14641, 0],
  [14641, 641],
  [0, 0],
  [1, 0],
  [100, 999],
]) {
  const rows = buildResolutionPlan(pending, exceptions);
  const excluded = Math.min(pending, exceptions);
  const goal = pending - excluded;
  assert.equal(rows[0].date, "2026-10-19");
  assert.equal(rows[0].cumulative, 0);
  assert.equal(rows.at(-1).date, "2026-12-31");
  assert.equal(rows.at(-1).remaining, 0);
  assert.equal(
    rows.reduce((total, row) => total + row.weekly, 0),
    goal,
  );
  assert.equal(rows.at(-1).physicalRemaining, excluded);
  rows.forEach((row, index) => {
    assert.ok(row.weekly >= 0);
    assert.equal(row.cumulative + row.remaining, goal);
    if (row.remaining > 0) assert.ok(row.percent < 100);
    if (index) assert.ok(row.cumulative >= rows[index - 1].cumulative);
  });
}
console.log("Resolution plan: 7 scenarios passed");
