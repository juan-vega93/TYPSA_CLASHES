import assert from "node:assert/strict";
import path from "node:path";
import { rolldown } from "rolldown";
const bundle = await rolldown({
  input: "src/lib/weekly-replan.ts",
  platform: "node",
  resolve: { alias: { "@": path.resolve("src") } },
});
const { output } = await bundle.generate({ format: "esm" });
await bundle.close();
const { createWeeklyReplan, weeklyReplanSchedule, weeklyReplanErrors, validWeeklyReplans } =
  await import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString("base64")}`);
const history = [
  { date: "2026-10-19", closed: 0 },
  { date: "2026-10-23", closed: 1801 },
  { date: "2026-11-03", closed: 2162 },
];
const version = createWeeklyReplan("base19", history, 6905, "2026-12-31", true);
assert.ok(validWeeklyReplans([version]));
assert.deepEqual(weeklyReplanErrors(version), []);
const schedule = weeklyReplanSchedule(version);
assert.equal(schedule[0].date, "2026-11-10");
assert.equal(schedule.at(-1).target, 9067);
assert.equal(
  schedule.reduce((sum, row) => sum + row.weekly, 0),
  6905,
);
assert.ok(schedule.every((row) => row.date > version.anchorDate && row.actual === null));
const manualGoals = Object.fromEntries(Object.keys(version.goals).map((date) => [date, 0]));
manualGoals[schedule[0].date] = 700;
manualGoals[schedule[1].date] = 900;
manualGoals[schedule.at(-1).date] = 5305;
const manual = {
  ...version,
  goals: manualGoals,
  actuals: { [schedule[0].date]: 2862, [schedule[1].date]: 3200 },
};
const manualSchedule = weeklyReplanSchedule(manual);
assert.equal(manualSchedule[0].target, 2862);
assert.equal(manualSchedule[1].target, 3762);
assert.equal(manualSchedule[1].deviation, -562);
assert.equal(manualSchedule.at(-1).target, 9067);
assert.deepEqual(weeklyReplanErrors(manual), []);
assert.ok(validWeeklyReplans(JSON.parse(JSON.stringify([manual]))));
assert.ok(!validWeeklyReplans([manual, manual]));
assert.ok(!validWeeklyReplans([{ ...manual, anchorClosed: 999 }]));
assert.ok(
  !validWeeklyReplans([
    { ...manual, history: [{ date: "2026-02-31", closed: 0 }, ...history.slice(1)] },
  ]),
);
assert.ok(!validWeeklyReplans([{ ...manual, actuals: { "2026-10-23": 1801 } }]));
assert.ok(weeklyReplanErrors({ ...manual, actuals: { [schedule[0].date]: 100 } }).length);
assert.ok(weeklyReplanErrors({ ...manual, actuals: { [schedule[0].date]: 9068 } }).length);
const blank = createWeeklyReplan("base19", history, 6905, "2026-12-31", false);
assert.ok(weeklyReplanErrors(blank).some((message) => message.includes("6905")));
assert.ok(validWeeklyReplans([blank]), "Unassigned drafts remain editable after reload");
assert.throws(() => createWeeklyReplan("base19", history, 6905, "2026-11-03", true));
assert.throws(() => createWeeklyReplan("base19", history, 0, "2026-12-31", true));
history[0].closed = 99;
assert.equal(
  version.history[0].closed,
  0,
  "Historical anchor is frozen without modifying the original base",
);
console.log(
  "Weekly replanning: frozen XML history, nonzero anchor, editable targets, running actuals, draft validation and backup compatibility passed",
);
