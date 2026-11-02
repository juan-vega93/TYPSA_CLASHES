export const PLAN_START = "2026-10-19";
export const PLAN_END = "2026-12-31";

// Weekly control dates; smoothstep gives a slow start, production ramp and validation tail.
export function buildResolutionPlan(
  pending: number,
  exceptions: number,
  options: { startDate?: string; endDate?: string; shape?: "s" | "linear" } = {},
) {
  const scope = Math.max(0, Math.floor(pending));
  const excluded = Math.min(scope, Math.max(0, Math.floor(exceptions)));
  const target = scope - excluded;
  const startDate = options.startDate ?? PLAN_START,
    endDate = options.endDate ?? PLAN_END;
  const start = Date.parse(`${startDate}T00:00:00Z`),
    end = Date.parse(`${endDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    new Date(start).toISOString().slice(0, 10) !== startDate ||
    new Date(end).toISOString().slice(0, 10) !== endDate ||
    end <= start ||
    end - start > 5 * 366 * 86400000
  )
    throw Error(
      "Selecciona fechas válidas, con fin posterior al inicio y un período menor a cinco años.",
    );
  const dates = [start];
  for (let date = start + 7 * 86400000; date < end; date += 7 * 86400000) dates.push(date);
  dates.push(end);
  let previous = 0;
  return dates.map((date) => {
    const t = (date - start) / (end - start);
    const cumulative = Math.round(target * (options.shape === "linear" ? t : t * t * (3 - 2 * t)));
    const weekly = cumulative - previous;
    previous = cumulative;
    const iso = new Date(date).toISOString().slice(0, 10);
    return {
      date: iso,
      label: `${iso.slice(8)}/${iso.slice(5, 7)}`,
      cumulative,
      weekly,
      remaining: target - cumulative,
      exceptions: excluded,
      physicalRemaining: scope - cumulative,
      percent: target ? Math.floor((cumulative / target) * 1000) / 10 : 100,
    };
  });
}
