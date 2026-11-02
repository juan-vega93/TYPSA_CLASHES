import { coordinationSchedule, planErrors, type CoordinationPlan } from "./coordination-plan";
const esc = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function downloadFile(
  name: string,
  data: string | Uint8Array | Blob,
  type = "application/octet-stream",
) {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type }),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function planGraphSvg(plan: CoordinationPlan) {
  const rows = coordinationSchedule(plan),
    width = 1120,
    height = 550,
    left = 85,
    top = 65,
    right = 35,
    bottom = 95;
  const max = Math.max(
    1,
    plan.baseCount,
    ...rows.map((row) => row.cumulative),
    ...rows.map((row) => row.actual ?? 0),
  );
  const x = (date: string) =>
    left +
    ((Date.parse(date) - Date.parse(plan.startDate)) /
      (Date.parse(plan.endDate) - Date.parse(plan.startDate))) *
      (width - left - right);
  const y = (value: number) => height - bottom - (value / max) * (height - top - bottom);
  const planned = rows
    .map((row) => `${x(row.date).toFixed(2)},${y(row.cumulative).toFixed(2)}`)
    .join(" ");
  const actual = rows.filter((row) => row.actual !== null);
  const grid = [...new Set(Array.from({ length: 6 }, (_, index) => Math.round((max * index) / 5)))]
    .map((value) => {
      return `<line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}" stroke="#dbe4e7" stroke-dasharray="4 4"/><text x="${left - 12}" y="${y(value) + 5}" text-anchor="end" font-size="14">${value.toLocaleString("es-PE")}</text>`;
    })
    .join("");
  const step = Math.max(1, Math.ceil(rows.length / 12));
  const labels = rows
    .filter(
      (row, index) =>
        index === rows.length - 1 || (index % step === 0 && x(plan.endDate) - x(row.date) >= 60),
    )
    .map(
      (row) =>
        `<text x="${x(row.date)}" y="${height - bottom + 25}" text-anchor="middle" font-size="13">${esc(row.label)}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Avance planeado y avance real manual"><rect width="100%" height="100%" fill="white"/><g fill="#203b43" font-family="Arial, sans-serif"><text x="${width / 2}" y="28" text-anchor="middle" font-size="19" font-weight="bold">PLAN DE RESOLUCIÓN · PLANEADO Y AVANCE REAL</text>${grid}${labels}<polyline points="${planned}" fill="none" stroke="#087c79" stroke-width="3"/>${actual.length > 1 ? `<polyline points="${actual.map((row) => `${x(row.date)},${y(row.actual!)}`).join(" ")}" fill="none" stroke="#c46c32" stroke-width="3" stroke-dasharray="8 5"/>` : ""}${actual.map((row) => `<circle cx="${x(row.date)}" cy="${y(row.actual!)}" r="4" fill="#c46c32"/>`).join("")}<text x="${left}" y="${height - 22}" font-size="15" fill="#087c79">Planeado acumulado</text><text x="${left + 300}" y="${height - 22}" font-size="15" fill="#a65325">Avance real manual${actual.length ? "" : " · sin registros"}</text></g></svg>`;
}
async function loadSvg(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(Error("No se pudo preparar el gráfico"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function graphPng(plan: CoordinationPlan) {
  return svgGraphPng(planGraphSvg(plan), 1120, 550);
}
export async function svgGraphPng(svg: string, width = 1120, height = 500) {
  const image = await loadSvg(svg),
    canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error("No se pudo exportar PNG"))),
      "image/png",
    ),
  );
}
export function jpegPagesToPdf(pages: { bytes: Uint8Array; width: number; height: number }[]) {
  if (!pages.length) throw Error("No hay páginas para exportar");
  const encode = (text: string) => new TextEncoder().encode(text),
    parts: Uint8Array[] = [encode("%PDF-1.4\n")],
    offsets = [0];
  let length = parts[0].length;
  const push = (bytes: Uint8Array) => {
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, content: Uint8Array[]) => {
    offsets[id] = length;
    push(encode(`${id} 0 obj\n`));
    content.forEach(push);
    push(encode("\nendobj\n"));
  };
  object(1, [encode("<< /Type /Catalog /Pages 2 0 R >>")]);
  object(2, [
    encode(
      `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`,
    ),
  ]);
  pages.forEach((page, index) => {
    const id = 3 + index * 3,
      stream = encode("q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n");
    object(id, [
      encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`,
      ),
    ]);
    object(id + 1, [
      encode(`<< /Length ${stream.length} >>\nstream\n`),
      stream,
      encode("endstream"),
    ]);
    object(id + 2, [
      encode(
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,
      ),
      page.bytes,
      encode("\nendstream"),
    ]);
  });
  const start = length,
    count = 3 + pages.length * 3;
  push(
    encode(
      `xref\n0 ${count}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
        .join("")}trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`,
    ),
  );
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
export async function planPdf(
  plan: CoordinationPlan,
  adapter?: {
    createCanvas: (width: number, height: number) => HTMLCanvasElement;
    loadSvg: (svg: string) => Promise<CanvasImageSource>;
  },
) {
  const errors = planErrors(plan);
  if (errors.length) throw Error(errors.join(" "));
  const makeCanvas =
    adapter?.createCanvas ??
    ((width, height) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    });
  const image = await (adapter?.loadSvg ?? loadSvg)(planGraphSvg(plan)),
    pages: HTMLCanvasElement[] = [];
  let canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    y = 0;
  const text = (value: string, x: number, baseline: number, size = 20) => {
    context.font = `${size}px Arial`;
    context.fillStyle = "#203b43";
    context.fillText(value, x, baseline);
  };
  const newPage = () => {
    canvas = makeCanvas(1240, 1754);
    context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.fillRect(0, 0, 1240, 1754);
    pages.push(canvas);
    text("PLAN SEMANAL DE RESOLUCIÓN DE INTERFERENCIAS", 60, 70, 28);
    text(`Corte: ${plan.cutDate}  |  Base guardada: ${plan.baseCount} resultados`, 60, 110);
    text(`${plan.startDate} → ${plan.endDate}`, 60, 145);
    y = 190;
  };
  newPage();
  const words = plan.title.split(/\s+/);
  let line = "",
    lines = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context!.measureText(next).width > 1100) {
      text(line, 60, y);
      y += 28;
      line = word;
      if (++lines >= 3) break;
    } else line = next;
  }
  if (lines < 3 && line) {
    text(line, 60, y);
    y += 30;
  }
  text(
    `C1: ${plan.summary.C1}   C2: ${plan.summary.C2}   C3: ${plan.summary.C3}   C4: ${plan.summary.C4}`,
    60,
    y,
  );
  y += 25;
  context!.drawImage(image, 60, y, 1120, 550);
  y += 590;
  const header = () => {
    context.fillStyle = "#e9f1f2";
    context.fillRect(60, y - 25, 1120, 40);
    ["Control", "Meta período", "Planeado acum.", "Real acum.", "Desviación"].forEach((label, i) =>
      text(label, 70 + i * 220, y, 18),
    );
    y += 45;
  };
  header();
  for (const row of coordinationSchedule(plan)) {
    if (y > 1600) {
      newPage();
      header();
    }
    [
      row.date,
      String(row.weekly),
      String(row.cumulative),
      row.actual === null ? "Sin registrar" : String(row.actual),
      row.deviation === null ? "—" : String(row.deviation),
    ].forEach((value, i) => text(value, 70 + i * 220, y, 18));
    context!.strokeStyle = "#dfe7e9";
    context!.beginPath();
    context!.moveTo(60, y + 12);
    context!.lineTo(1180, y + 12);
    context!.stroke();
    y += 38;
  }
  if (y > 1540) newPage();
  y += 35;
  text("Avance real introducido manualmente. La base no cambia al cargar otro corte.", 60, y, 17);
  y += 28;
  text(
    "Los candidatos a pases requieren validación; los resultados agrupados no son aberturas confirmadas.",
    60,
    y,
    16,
  );
  return jpegPagesToPdf(
    pages.map((page) => {
      const binary = atob(page.toDataURL("image/jpeg", 0.94).split(",")[1]);
      return {
        width: page.width,
        height: page.height,
        bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0)),
      };
    }),
  );
}
