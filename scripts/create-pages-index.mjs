import { copyFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = ".output/public";
const assetsDir = join(outDir, "assets");
const base = process.env.GITHUB_PAGES === "true" ? "/TYPSA_CLASHES/" : "/";

const indexScript = readdirSync(assetsDir).find((file) => /^index-.*\.js$/.test(file));
const styles = readdirSync(assetsDir).find((file) => /^styles-.*\.css$/.test(file));

if (!indexScript) {
  throw new Error("No client index bundle found in .output/public/assets");
}

const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>IREN SUR - Dashboard de gestion de clashes</title>
    <meta
      name="description"
      content="Dashboard TYPSA para gestion historica de clashes BIM."
    />
    <link rel="icon" href="${base}favicon.ico" />
    ${styles ? `<link rel="stylesheet" href="${base}assets/${styles}" />` : ""}
  </head>
  <body>
    <script type="module" src="${base}assets/${indexScript}"></script>
  </body>
</html>
`;

writeFileSync(join(outDir, "index.html"), html);

if (existsSync(join(outDir, "index.html"))) {
  copyFileSync(join(outDir, "index.html"), join(outDir, "404.html"));
}
