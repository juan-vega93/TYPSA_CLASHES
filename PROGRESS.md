# Contexto del proyecto `TYPSA_CLASHES`

## Objetivo

Dashboard web para visualizar, filtrar y gestionar clashes BIM de Navisworks/XML para TYPSA / IREN SUR, con historial por fechas y despliegue público en GitHub Pages.

## Implementado

- Carga de XML desde `src/data/**/*.xml`.
- Soporte de carpetas fechadas tipo `src/data/260707/*.xml` o `src/data/YYYYMMDD/*.xml`.
- El snapshot más reciente se usa como estado actual.
- Los snapshots anteriores alimentan la gráfica histórica de clashes resueltos/por resolver.
- Parseo de XML en Web Worker para no bloquear la UI.
- Índices de filtros y búsqueda para mejorar rendimiento con muchos clashes.
- Tabla de gestión virtualizada.
- Tabs cargadas con lazy/code splitting.
- Mapa espacial con muestreo de puntos para evitar render masivo SVG.
- Filtros:
  - Test
  - Estado
  - Severidad
  - Zona
  - Nivel
  - Edificio
  - Sector
  - Par categ.
  - Contenedor
  - Prioridad
- `Contenedor` reemplazó el filtro anterior de `Archivo`.
- `Prioridad` se extrae de nombres tipo `P1_EST-ACI`, `P2_ARQ-IME`.
- Configuracion centralizada en `src/config/project.json` para campos IREN SUR,
  umbrales de severidad, campo `guid` y patron de prioridad.
- Modal de configuracion del proyecto conectado a overrides locales; al guardar
  o restaurar se reinician los filtros activos.
- Logo TYPSA en header.
- Título `IREN SUR` en rojo TYPSA.
- Subtítulo `Dashboard de gestion de clashes`.
- Git inicializado y conectado a:
  `https://github.com/juan-vega93/TYPSA_CLASHES`
- GitHub Pages configurado con workflow propio.
- Build específico para Pages como SPA, porque TanStack Start SSR dejaba la página en blanco.
- URL pública esperada:
  `https://juan-vega93.github.io/TYPSA_CLASHES/`

## Decisiones clave

- Mantener XML versionados en Git por ahora.
- Agregar nuevas fechas copiando XML a `src/data/YYMMDD/`.
- No sobrescribir carpetas viejas si se quiere conservar historial.
- A futuro, si los XML crecen demasiado o son sensibles, moverlos fuera del repo a storage/API.
- Mantener el build normal de TanStack Start para desarrollo.
- Usar `build:pages` para GitHub Pages estático.

## Archivos importantes

- `src/lib/clash-parser.ts`
  Parser XML. Extrae items, contenedor, prioridad, coordenadas, estado, distancia y severidad usando configuracion centralizada.
- `src/lib/clash-types.ts`
  Tipos principales y funcion `severityFor`, ahora alimentada por `src/config/project.json`.
- `src/lib/project-config.ts`
  Normaliza la configuracion default y overrides locales; expone helpers para parser, severidad y filtros.
- `src/config/project.schema.ts`
  Schema TypeScript para campos, severidad, GUID y extraccion de prioridad.
- `src/config/project.json`
  Configuracion default IREN SUR con tags XML actuales, umbrales 0.1/0.01,
  `guidField: "guid"` y regex `\b(P\d+)(?:[_-]|\b)`.
- XML Navisworks actual:
  - El GUID exportado existe solo como atributo del clash: `<clashresult guid="...">`.
  - Dentro de cada `<clashobject>` no hay `GlobalId`, `IfcGUID`, `Element GUID`,
    `UniqueId` ni atributo equivalente para identificar individualmente los elementos BIM.
  - El identificador disponible por elemento es el smarttag `<name>Element Id</name>`,
    que corresponde al ID de elemento exportado por Navisworks/Revit, no al IFC GlobalId.
  - Para un visor BIM futuro, si se necesita seleccionar elementos IFC por GUID,
    habra que incorporar otra fuente/export adicional con el mapeo Revit/Navisworks/IFC.
- `src/components/dashboard/project-settings-dialog.tsx`
  Modal de configuracion para overrides locales del proyecto.
- `src/lib/use-clashes.ts`
  Carga XML recursiva, agrupa snapshots fechados y usa Worker.
- `src/lib/clash-worker.ts`
  Web Worker para parseo.
- `src/lib/clash-query.ts`
  Índices, filtros, búsqueda, métricas y bounds.
- `src/components/dashboard/filters.tsx`
  Barra de filtros.
- `src/components/dashboard/kpis.tsx`
  KPIs.
- `src/components/dashboard/tab-gestion.tsx`
  Tabla virtualizada de gestión.
- `src/components/dashboard/virtual-table.tsx`
  Hook de virtualización.
- `src/components/dashboard/tab-timeline.tsx`
  Gráfica histórica por snapshots.
- `src/components/dashboard/tab-ubicacion.tsx`
  Mapa espacial y heatmap.
- `src/routes/index.tsx`
  Layout principal/header/tabs.
- `src/pages-entry.tsx`
  Entrada SPA para GitHub Pages.
- `pages/index.html`
  HTML estático para Pages.
- `vite.pages.config.ts`
  Config Vite específica de GitHub Pages.
- `.github/workflows/deploy-pages.yml`
  Workflow de GitHub Pages.
- `scripts/create-pages-index.mjs`
  Script anterior para Pages; hoy el flujo principal usa `build:pages`. Puede quedar como legado o limpiarse.
- `public/typsa-logo.jpg`
  Logo TYPSA.
- `PERFORMANCE_REPORT.md`
  Informe de arquitectura/rendimiento.

## Comandos útiles

```bash
npm run dev
npm run build
npm run build:pages
git status
git add .
git commit -m "mensaje"
git push
```

## Procedimiento para agregar XML

```text
src/data/260710/
  P1_EST-ACI.xml
  P2_ARQ-IME.xml
```

Luego:

```bash
git add src/data
git commit -m "Agregar snapshot XML 260710"
git push
```

GitHub Actions reconstruye Pages automáticamente.

## Commits relevantes

- `ef9cc5e` Initial TYPSA clashes dashboard
- `3298013` Configure GitHub Pages deployment
- `f693eb6` Add nojekyll marker for Pages artifact
- `b77da15` Use SPA build for GitHub Pages

## Pendiente

- Verificar visualmente GitHub Pages tras el último deploy.
- Limpiar o retirar `scripts/create-pages-index.mjs` si se decide eliminar el flujo anterior.
- Segunda fase: integrar visor BIM con That Open Company:
  - `@thatopen/components`
  - `@thatopen/fragments`
  - mapear `Element ID`/Navisworks/Revit a ids del visor
  - seleccionar clash en tabla y aislar/resaltar elementos
  - seleccionar elementos en visor y filtrar clashes relacionados.
- Evaluar mover XML fuera del bundle/repo si el peso sigue creciendo.

## En progreso

## Próximos módulos
