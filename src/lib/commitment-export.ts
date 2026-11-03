import type { CutBalance, ForecastVersion } from "./commitment-control";
import {
  MOVEMENT_LABELS,
  forecastPoints,
  periodNarrative,
  movementTotals,
} from "./commitment-control";
import type { CoordinationPlan } from "./coordination-plan";
import { coordinationSchedule, planErrors } from "./coordination-plan";
import { jpegPagesToPdf } from "./plan-export";
import { breakdownSvg, type BreakdownRow } from "./commitment-breakdown";
const esc = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export interface ControlReport {
  title: string;
  plan?: CoordinationPlan;
  cuts: CutBalance[];
  selected: CutBalance;
  scope: string;
  scopeDetails?: string;
  forecast?: ForecastVersion;
  notes: string[];
  membership?: { closed: number; pending: number; missing: number; unmatched: number };
  compareInventoryPlan?: boolean;
  includeAppendix?: boolean;
  warnings?: string[];
  breakdown?: BreakdownRow[];
}
interface Series {
  name: string;
  color: string;
  dashed?: boolean;
  points: { date: string; value: number }[];
}
export function lineChart(title: string, series: Series[]) {
  const all = series.flatMap((s) => s.points).filter((p) => Number.isFinite(Date.parse(p.date)));
  if (!all.length)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="500"><rect width="100%" height="100%" fill="white"/><text x="50" y="70" font-family="Arial" font-size="20">${esc(title)}: sin datos</text></svg>`;
  const dates = [...new Set(all.map((p) => p.date))].sort(),
    min = Date.parse(dates[0]),
    maxDate = Math.max(min + 86400000, Date.parse(dates.at(-1)!));
  const max = Math.max(1, ...all.map((p) => p.value));
  const minimum = Math.min(0, ...all.map((p) => p.value));
  const x = (d: string) => 85 + ((Date.parse(d) - min) / (maxDate - min)) * 1000;
  const y = (v: number) => 385 - ((v - minimum) / (max - minimum)) * 305;
  const ticks = [
    ...new Set(
      Array.from({ length: 6 }, (_, i) => Math.round(minimum + ((max - minimum) * i) / 5)),
    ),
  ];
  const step = Math.max(1, Math.ceil(dates.length / 8));
  const legendColumns = series.length > 3 ? 2 : 1;
  const legendX = (i: number) => 85 + (i % legendColumns) * 540;
  const legendY = (i: number) => 442 + Math.floor(i / legendColumns) * 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="500" viewBox="0 0 1120 500" role="img" aria-label="${esc(title)}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, sans-serif" fill="#203b43"><text x="560" y="35" font-size="21" text-anchor="middle" font-weight="bold">${esc(title)}</text>${ticks.map((v) => `<line x1="85" x2="1085" y1="${y(v)}" y2="${y(v)}" stroke="#dce4e7"/><text x="75" y="${y(v) + 5}" font-size="14" text-anchor="end">${v.toLocaleString("es-PE")}</text>`).join("")}${dates
    .filter((d, i) => i === dates.length - 1 || (i % step === 0 && x(dates.at(-1)!) - x(d) > 75))
    .map(
      (d) =>
        `<text x="${x(d)}" y="410" text-anchor="middle" font-size="13">${d.slice(8)}/${d.slice(5, 7)}/${d.slice(2, 4)}</text>`,
    )
    .join(
      "",
    )}${series.map((s) => `<polyline points="${s.points.map((p) => `${x(p.date)},${y(p.value)}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="3" ${s.dashed ? 'stroke-dasharray="8 5"' : ""}/>${s.points.map((p) => `<circle cx="${x(p.date)}" cy="${y(p.value)}" r="3" fill="${s.color}"/>`).join("")}`).join("")}${series.map((s, i) => `<line x1="${legendX(i)}" x2="${legendX(i) + 35}" y1="${legendY(i)}" y2="${legendY(i)}" stroke="${s.color}" stroke-width="3" ${s.dashed ? 'stroke-dasharray="8 5"' : ""}/><text x="${legendX(i) + 45}" y="${legendY(i) + 5}" font-size="14">${esc(s.name)}</text>`).join("")}</g></svg>`;
}
export const CONTROL_GRAPH_LABELS = {
  summary: "Resumen ejecutivo",
  commitment: "Compromiso",
  inventory: "Pendiente",
  balance: "Balance",
};
export function periodSummarySvg(cut: CutBalance) {
  const { entries, otherExits } = movementTotals(cut);
  const n = (value: number) => value.toLocaleString("es-PE");
  const percentage = (part: number, total: number) =>
    total ? ((part / total) * 100).toFixed(1) + "%" : "—";
  const outcome = cut.initial
    ? "Primer corte: sin comparación"
    : cut.delta > 0
      ? "El pendiente aumentó"
      : cut.delta < 0
        ? "El pendiente disminuyó"
        : "El pendiente se mantuvo";
  const load = cut.opening + entries;
  const sources = [
    { label: "Cerrados en el período", value: cut.counts.closed, color: "#059669" },
    { label: "Pendientes al final", value: cut.pending, color: "#b91c1c" },
    { label: "Otras salidas (sin cierre)", value: otherExits, color: "#94a3b8" },
  ].filter((source) => source.value > 0);
  const bars = [
    { label: "Entradas de pendientes", value: entries, color: "#d97706" },
    { label: "Cierres por estado XML", value: cut.counts.closed, color: "#059669" },
    { label: "Otras salidas: sin cierre acreditado", value: otherExits, color: "#94a3b8" },
  ];
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const circumference = 2 * Math.PI * 88;
  let offset = 0;
  const ring = sources
    .map((source) => {
      const length = (source.value / Math.max(1, load)) * circumference;
      const segment = `<circle cx="718" cy="252" r="88" fill="none" stroke="${source.color}" stroke-width="34" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 718 252)"/>`;
      offset += length;
      return segment;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="580" viewBox="0 0 1120 580" role="img" aria-label="Entradas, cierres y estado de la carga del período"><rect width="100%" height="100%" fill="white"/><g fill="#203b43" font-family="Arial, sans-serif"><text x="560" y="34" text-anchor="middle" font-size="23" font-weight="bold">LECTURA EJECUTIVA DEL PERÍODO</text><text x="560" y="61" text-anchor="middle" font-size="16">${cut.initial ? "Primer corte: sin comparación anterior" : esc(cut.fromDate) + " → " + esc(cut.date)}</text><text x="50" y="105" font-size="20" font-weight="bold">¿Se compensan las entradas?</text><text x="570" y="105" font-size="20" font-weight="bold">¿Cómo queda la carga del período?</text>${bars.map((bar, i) => `<text x="50" y="${153 + i * 90}" font-size="17">${bar.label}</text><text x="525" y="${153 + i * 90}" text-anchor="end" font-size="21" font-weight="bold">${n(bar.value)}</text><rect x="50" y="${166 + i * 90}" width="475" height="25" rx="4" fill="#f1f5f9"/><rect x="50" y="${166 + i * 90}" width="${(bar.value / max) * 475}" height="25" rx="4" fill="${bar.color}"/>`).join("")}<circle cx="718" cy="252" r="88" fill="none" stroke="#e2e8f0" stroke-width="34"/>${ring}<text x="718" y="250" text-anchor="middle" font-size="29" font-weight="bold">${n(load)}</text><text x="718" y="277" text-anchor="middle" font-size="16">carga del período</text>${sources.map((source, i) => `<rect x="852" y="${152 + i * 49}" width="12" height="12" rx="2" fill="${source.color}"/><text x="873" y="${164 + i * 49}" font-size="14">${source.label}</text><text x="873" y="${184 + i * 49}" font-size="17" font-weight="bold">${n(source.value)} · ${percentage(source.value, load)}</text>`).join("")}${!load ? '<text x="650" y="390" font-size="17">Sin carga observada</text>' : ""}<text x="570" y="375" font-size="15">Inicio ${n(cut.opening)} + entradas ${n(entries)} = ${n(load)}</text><rect x="50" y="438" width="1030" height="101" rx="10" fill="${cut.delta > 0 ? "#fff7ed" : "#f1f5f9"}"/><text x="66" y="465" font-size="17">${outcome}</text><text x="66" y="511" font-size="31" font-weight="bold">${cut.initial ? "—" : (cut.delta > 0 ? "+" : "") + n(cut.delta)}</text><text x="270" y="485" font-size="16">${cut.initial ? "Selecciona otro corte para ver el movimiento" : `${n(entries)} entradas - ${n(cut.counts.closed)} cierres - ${n(otherExits)} otras salidas`}</text><text x="270" y="514" font-size="16">${cut.initial || !cut.opening ? "" : (cut.delta > 0 ? "+" : "") + percentage(cut.delta, cut.opening) + " frente a los pendientes iniciales"}</text></g></svg>`;
}
export function commitmentGraphs(report: ControlReport) {
  const schedule = report.plan ? coordinationSchedule(report.plan) : [];
  const commitment = lineChart("¿Cumplimos el compromiso original?", [
    {
      name: "Planeado original acumulado",
      color: "#0d9488",
      points: schedule.map((r) => ({ date: r.date, value: r.cumulative })),
    },
    {
      name: "Avance real manual acumulado",
      color: "#c46c32",
      dashed: true,
      points: schedule
        .filter((r) => r.actual !== null && r.date <= report.selected.date)
        .map((r) => ({ date: r.date, value: r.actual! })),
    },
  ]);
  const inventory = lineChart("¿Cuánto queda y cuándo terminaríamos?", [
    ...(report.plan && report.compareInventoryPlan !== false
      ? [
          {
            name: "Pendiente planeado original (alcance de la base)",
            color: "#64748b",
            points: schedule.map((r) => ({ date: r.date, value: r.remaining })),
          },
        ]
      : []),
    {
      name: "Pendiente observado (alcance seleccionado)",
      color: "#b91c1c",
      points: report.cuts.map((r) => ({ date: r.date, value: r.pending })),
    },
    ...(report.forecast
      ? [
          {
            name: "Proyección versionada (supuestos explícitos)",
            color: "#0d9488",
            dashed: true,
            points: forecastPoints(report.forecast).points,
          },
        ]
      : []),
  ]);
  const selected = report.selected;
  const movements = Object.entries(selected.counts)
    .filter(([, v]) => v)
    .map(([key, count]) => ({
      name: MOVEMENT_LABELS[key as keyof typeof MOVEMENT_LABELS],
      value:
        count *
        (key === "closed" || key === "missing" || key === "coverageOut" || key === "scopeOut"
          ? -1
          : 1),
      kind: key,
    }));
  let running = selected.opening;
  const bars = [
    { name: "Inicio", value: selected.opening, bottom: 0, top: selected.opening, color: "#64748b" },
    ...movements.map((m) => {
      const start = running;
      running += m.value;
      return {
        name: m.name,
        value: m.value,
        bottom: Math.min(start, running),
        top: Math.max(start, running),
        color: m.kind === "closed" ? "#059669" : m.value > 0 ? "#d97706" : "#94a3b8",
      };
    }),
    { name: "Cierre", value: selected.pending, bottom: 0, top: selected.pending, color: "#b91c1c" },
  ];
  const max = Math.max(1, ...bars.map((b) => b.top));
  const y = (v: number) => 360 - (v / max) * 270;
  const bw = 1000 / bars.length;
  const balance = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="500" viewBox="0 0 1120 500" role="img" aria-label="Balance del período"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, sans-serif" fill="#203b43"><text x="560" y="35" text-anchor="middle" font-size="21" font-weight="bold">¿Por qué cambió el pendiente? · ${esc(selected.date)}</text><text x="560" y="62" text-anchor="middle" font-size="14">${selected.initial ? "Primer corte: no hay período anterior para comparar." : "Salidas grises son ausencias o cambios de alcance; no se acreditan como cierres."}</text>${bars
    .map((bar, i) => {
      const words = bar.name.split(" "),
        lines: string[] = [];
      for (const word of words) {
        if (!lines.length || lines.at(-1)!.length + word.length > 17) lines.push(word);
        else lines[lines.length - 1] += " " + word;
      }
      return `<rect x="${85 + i * bw + 8}" y="${y(bar.top)}" width="${Math.max(8, bw - 16)}" height="${Math.max(1, y(bar.bottom) - y(bar.top))}" fill="${bar.color}"/><text x="${85 + (i + 0.5) * bw}" y="${y(bar.top) - 10}" text-anchor="middle" font-size="14">${i > 0 && i < bars.length - 1 && bar.value > 0 ? "+" : ""}${bar.value.toLocaleString("es-PE")}</text>${lines.map((line, j) => `<text x="${85 + (i + 0.5) * bw}" y="${385 + j * 17}" text-anchor="middle" font-size="12">${esc(line)}</text>`).join("")}`;
    })
    .join("")}</g></svg>`;
  return { summary: periodSummarySvg(selected), commitment, inventory, balance };
}
export function controlCsv(report: ControlReport) {
  const cell = (v: unknown) =>
    `"${String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`;
  const rows: unknown[][] = [
    [
      "Corte",
      "Desde",
      "Inicial",
      "Pendiente",
      "Variación",
      ...Object.values(MOVEMENT_LABELS),
      "Alcance",
      "Línea base",
      "Definición del alcance",
    ],
    ...report.cuts.map((c) => [
      c.date,
      c.fromDate ?? "",
      c.opening,
      c.pending,
      c.initial ? "" : c.delta,
      ...Object.keys(MOVEMENT_LABELS).map((k) =>
        c.initial ? "" : c.counts[k as keyof typeof c.counts],
      ),
      report.scope,
      report.plan?.title ?? "Sin línea base",
      report.scopeDetails ?? report.scope,
    ]),
  ];
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
export function eventCsv(cut: CutBalance) {
  const cell = (v: unknown) =>
    `"${String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [
      [
        "Corte",
        "Movimiento",
        "Test",
        "GUID",
        "Nombre",
        "Estado anterior",
        "Estado actual",
        "Variación pendiente",
      ],
      ...cut.events.map((e) => [
        cut.date,
        MOVEMENT_LABELS[e.kind],
        e.test,
        e.id,
        e.name,
        e.before,
        e.after,
        e.delta,
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}
export function controlReportPages(report: ControlReport) {
  const graphs = commitmentGraphs(report);
  const forecast = report.forecast ? forecastPoints(report.forecast) : undefined;
  const lastManual = report.plan
    ? coordinationSchedule(report.plan)
        .filter((row) => row.actual !== null && row.date <= report.selected.date)
        .at(-1)
    : undefined;
  const page = (title: string, body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754"><rect width="100%" height="100%" fill="white"/><g font-family="Arial, sans-serif" fill="#203b43"><text x="60" y="65" font-size="27" font-weight="bold">CONTROL DE COMPROMISOS · COORDINACIÓN BIM</text><text x="60" y="105" font-size="20">${esc(title)}</text><text x="60" y="140" font-size="18">Corte ${esc(report.selected.date)} · ${esc(report.plan?.title.slice(0, 90) ?? "Sin línea base")}</text>${body}<text x="60" y="1710" font-size="15">Estados XML observados y avance manual son registros separados. Ausencia no acredita resolución.</text></g></svg>`;
  const lines = (values: string[], start: number, size = 18) =>
    values
      .map(
        (line, i) =>
          `<text x="60" y="${start + i * 27}" font-size="${size}">${esc(line.slice(0, 125))}</text>`,
      )
      .join("");
  const embed = (svg: string, y: number, height: number) =>
    `<svg x="60" y="${y}" width="1120" height="${height}" viewBox="0 0 1120 ${height}">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>`;
  const cut = report.selected;
  const totals = movementTotals(cut);
  const n = (value: number) => value.toLocaleString("es-PE");
  const cards = [
    {
      label: "Al inicio",
      value: n(cut.opening),
      hint: "Pendientes del corte anterior",
      color: "#94a3b8",
    },
    {
      label: "Se cerraron",
      value: cut.initial ? "—" : n(cut.counts.closed),
      hint: "Resueltos / aprobados en XML",
      color: "#059669",
    },
    {
      label: "Entraron",
      value: cut.initial ? "—" : n(totals.entries),
      hint: "Nuevos y otras entradas",
      color: "#d97706",
    },
    {
      label: "Quedan por cerrar",
      value: n(cut.pending),
      hint: "Pendientes al corte final",
      color: "#b91c1c",
    },
  ];
  const balanceHeader = `<g transform="translate(60 185)"><text y="18" font-size="19" font-weight="bold">BALANCE DEL PERÍODO</text><text y="43" font-size="14">${esc(cut.fromDate ?? cut.date)} → ${esc(cut.date)} · ${esc(report.scope.slice(0, 115))}</text>${cards.map((card, i) => `<g transform="translate(${i * 283} 60)"><rect width="271" height="105" rx="8" fill="white" stroke="${card.color}" stroke-width="2"/><text x="14" y="26" font-size="16">${card.label}</text><text x="14" y="61" font-size="29" font-weight="bold">${card.value}</text><text x="14" y="86" font-size="13">${card.hint}</text></g>`).join("")}<text y="195" font-size="15">${cut.initial ? "Primer corte: sin comparación anterior." : `${n(cut.opening)} iniciales + ${n(totals.entries)} entradas - ${n(cut.counts.closed)} cierres - ${n(totals.otherExits)} otras salidas = ${n(cut.pending)} pendientes. Cambio: ${cut.delta > 0 ? "+" : ""}${n(cut.delta)}.`}</text></g>`;
  const forecastLines = [
    report.forecast
      ? `Escenario: ${report.forecast.closuresPerWeek} cierres y ${report.forecast.arrivalsPerWeek} entradas por semana.`
      : "Sin proyección guardada para este alcance y corte.",
    forecast
      ? `Fecha estimada: ${forecast.completion ?? "sin convergencia con estos supuestos"}.`
      : "Introduce capacidad y entradas semanales para guardar un escenario.",
    "La proyección es un supuesto, no una fecha garantizada. El alcance detallado se conserva en CSV y anexo.",
    ...(forecast?.truncated
      ? ["El horizonte gráfico de la proyección se limita a 104 semanas."]
      : []),
  ];
  const curveBody = report.plan
    ? embed(graphs.commitment, 190, 500) +
      lines(
        [
          lastManual
            ? `Avance manual al ${lastManual.date}: ${lastManual.actual} acumulados (${((lastManual.actual! / report.plan.baseCount) * 100).toFixed(1)}% de la base).`
            : "Sin avance real manual registrado hasta el corte de evaluación.",
          "El compromiso original mantiene sus metas; el estado XML no sustituye el avance manual.",
        ],
        730,
        17,
      ) +
      embed(graphs.inventory, 840, 500) +
      lines(forecastLines, 1400, 17)
    : embed(graphs.inventory, 190, 500) +
      lines(
        [...forecastLines, "Sin línea base seleccionada: no se compara un compromiso original."],
        740,
        17,
      );
  const pages = [
    page(
      "Resumen visual del período",
      balanceHeader +
        embed(graphs.summary, 410, 580) +
        lines(periodNarrative(report.selected), 1020, 16) +
        embed(graphs.balance, 1110, 500) +
        lines(report.warnings ?? [], 1635, 14),
    ),
    page(
      report.plan ? "Compromiso original y proyección vigente" : "Pendiente observado y proyección",
      curveBody,
    ),
  ];
  const columns = [60, 240, 420, 570, 730, 900, 1040];
  for (let offset = 0; offset < (report.breakdown?.length ?? 0); offset += 18) {
    const rows = report.breakdown!.slice(offset, offset + 18);
    pages.push(
      page(
        "Entradas y cierres por encuentro",
        embed(breakdownSvg(rows), 190, 120 + rows.length * 62) +
          lines(
            [
              "Cada resultado se cuenta una vez por test o par de especialidades.",
              "Las entradas muestran dónde aparece la carga; no atribuyen la causa a una especialidad.",
              `Alcance: ${report.scope}`,
            ],
            1510,
            17,
          ),
      ),
    );
  }
  for (
    let offset = 0;
    report.includeAppendix !== false && offset < report.cuts.length;
    offset += 30
  ) {
    const cuts = report.cuts.slice(offset, offset + 30);
    pages.push(
      page(
        "Conciliación entre cortes",
        `<g font-size="15">${["Corte", "Inicio", "Entradas", "Cierres XML", "Otras salidas", "Final", "Variación"].map((t, i) => `<text x="${columns[i]}" y="205">${t}</text>`).join("")}${cuts.map((c, j) => [c.date, c.opening, c.initial ? "—" : movementTotals(c).entries, c.initial ? "—" : c.counts.closed, c.initial ? "—" : movementTotals(c).otherExits, c.pending, c.initial ? "—" : c.delta].map((v, i) => `<text x="${columns[i]}" y="${245 + j * 38}">${esc(v)}</text>`).join("")).join("")}</g>` +
          lines(
            [
              "Entradas: nuevos, reabiertos, reaparecidos, cobertura incorporada e ingresos por reclasificación.",
              "Otras salidas: no localizados, cobertura retirada y salidas por reclasificación; no acreditan resolución.",
              "Inicio + entradas - cierres XML - otras salidas = final. El CSV permite revisar cada componente.",
            ],
            1500,
            16,
          ),
      ),
    );
  }
  if (report.scopeDetails && report.includeAppendix !== false) {
    const scope = JSON.parse(report.scopeDetails);
    const list = (values: unknown) => (Array.isArray(values) ? values.join(", ") : "Sin selección");
    const fieldLabels: Record<string, string> = {
      test: "Test",
      nivel: "Nivel",
      nivelSource: "Objeto para nivel",
      zona: "Zona",
      edificio: "Edificio",
      sector: "Sector",
      contenedor: "Contenedor",
      status: "Estado",
      severity: "Severidad",
      search: "Búsqueda",
      categoria: "Par de categorías",
      prioridad: "Prioridad",
    };
    const items = [
      ...report.notes,
      `Clases incluidas: ${list(scope.classes)}`,
      `Tests incluidos: ${list(scope.tests)}`,
      `Categorías prioritarias C1/C2: ${list(scope.rules?.priorityCategories)}`,
      `Receptores de posibles pases: ${list(scope.rules?.openingCategories)}`,
      `Redes candidatas a pases: ${list(scope.rules?.serviceCategories)}`,
      `Colgadores: ${scope.rules?.excludeHangers ? "separados en C4" : "clasificados por categoría, sin separación"}.`,
      ...Object.entries(scope.filters ?? {}).map(
        ([key, value]) =>
          `${fieldLabels[key] ?? key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`,
      ),
    ];
    const details = items.flatMap((value) => {
      const result: string[] = [];
      let line = "";
      for (const word of value.split(/\s+/)) {
        if (line.length + word.length > 110) {
          result.push(line);
          line = word;
        } else line += (line ? " " : "") + word;
      }
      if (line) result.push(line);
      result.push("");
      return result;
    });
    for (let offset = 0; offset < details.length; offset += 48)
      pages.push(
        page(
          "Definición del alcance y criterios guardados",
          lines(details.slice(offset, offset + 48), 210, 15),
        ),
      );
  }
  return pages;
}
export async function controlPdf(
  report: ControlReport,
  adapter?: {
    createCanvas: (width: number, height: number) => HTMLCanvasElement;
    loadSvg: (svg: string) => Promise<CanvasImageSource>;
  },
) {
  if (report.plan && planErrors(report.plan).length)
    throw Error(
      "Corrige las metas o el avance manual de la línea base antes de emitir el reporte.",
    );
  return svgPagesPdf(controlReportPages(report), adapter);
}
export async function svgPagesPdf(
  pageSvgs: string[],
  adapter?: {
    createCanvas: (width: number, height: number) => HTMLCanvasElement;
    loadSvg: (svg: string) => Promise<CanvasImageSource>;
  },
) {
  const pages = [];
  for (const svg of pageSvgs) {
    const canvas = adapter?.createCanvas(1240, 1754) ?? document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    let image: CanvasImageSource;
    if (adapter) image = await adapter.loadSvg(svg);
    else {
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      try {
        image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(Error("No se pudo preparar el reporte"));
          img.src = url;
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    canvas.getContext("2d")!.drawImage(image, 0, 0, 1240, 1754);
    const binary = atob(canvas.toDataURL("image/jpeg", 0.94).split(",")[1]);
    pages.push({
      width: 1240,
      height: 1754,
      bytes: Uint8Array.from(binary, (c) => c.charCodeAt(0)),
    });
  }
  return jpegPagesToPdf(pages);
}
