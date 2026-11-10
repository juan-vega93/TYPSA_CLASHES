export async function fetchClashXml(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw Error(`No se pudo descargar el XML (${response.status})`);
  if (!/\.xml\.gz(?:[?#]|$)/i.test(url)) return response.text();
  if (!response.body || typeof DecompressionStream === "undefined")
    throw Error("Abre el tablero en un navegador actualizado para leer los cortes comprimidos.");
  return new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).text();
}
