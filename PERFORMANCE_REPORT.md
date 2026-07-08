# Informe de arquitectura y rendimiento

## 1. Problemas detectados

- La carga de XML usaba `import.meta.glob(..., eager: true)`, lo que metia todos los XML en el bundle inicial y forzaba parseo sincronico durante el primer render.
- `fast-xml-parser` corria en el hilo principal. Con XML grandes, la UI podia quedar bloqueada antes de pintar controles.
- Los filtros recorrian todos los clashes en cada cambio y reconstruian texto de busqueda por fila en cada ejecucion.
- Las opciones de filtros se recalculaban desde el array completo en la UI.
- Las KPIs hacian multiples `filter` y `reduce` sobre el mismo arreglo filtrado.
- La tabla de gestion renderizaba una tabla tradicional y limitaba a 300 filas; evitaba el colapso, pero no permitia trabajar fluidamente con datasets grandes.
- El mapa espacial podia intentar renderizar decenas de miles de puntos SVG con Recharts.
- El calculo de bounds usaba arrays temporales y spread (`Math.min(...xs)`), riesgoso con arreglos masivos.
- Cada `ClashItem` retenia todos los `smarttags` crudos en `raw`, duplicando texto que la UI no usa.
- Las tabs y Recharts entraban en el grafo principal de la ruta, aumentando el coste de JavaScript inicial.

## 2. Cambios realizados

- Separacion de arquitectura:
  - Parser: `src/lib/clash-parser.ts`.
  - Worker de parseo: `src/lib/clash-worker.ts`.
  - Carga/orquestacion: `src/lib/use-clashes.ts`.
  - Indices, consultas, metricas y bounds: `src/lib/clash-query.ts`.
  - Presentacion: componentes en `src/components/dashboard/*`.
- XML base cargado con `import.meta.glob` lazy en vez de eager.
- Parseo de XML movido a Web Worker, con fallback dinamico cuando Worker no esta disponible.
- Filtros convertidos a consultas sobre indices por campo (`Map<valor, ids[]>`) con interseccion de ids.
- Texto de busqueda precomputado por clash en el indice.
- Opciones de filtros precalculadas en el indice.
- KPIs consolidadas en una sola pasada con `summarizeClashes`.
- Busqueda con `useDeferredValue` para suavizar escritura en el input.
- Tabs cargadas con `React.lazy` y `Suspense` para code splitting.
- Tabla de gestion virtualizada con ventana de filas y header sticky.
- Mapa espacial muestreado a un maximo de 5000 puntos visibles para evitar miles de nodos SVG.
- Bounds globales y locales calculados en una sola pasada sin arrays temporales.
- `raw` de `ClashItem` hecho opcional y no retenido por defecto para reducir memoria.
- Correccion de persistencia inicial en `useClashState` para no sobrescribir overrides guardados al montar.

## 3. Impacto esperado

- Primer render mas rapido: los XML ya no se parsean durante render y las tabs pesadas no bloquean el bundle inicial.
- UI responsiva durante carga: el parseo se ejecuta fuera del hilo principal.
- Filtros mas estables con 100 000 clashes: los filtros exactos pasan de scan completo por campo a interseccion de listas indexadas.
- Menos basura de memoria: se eliminan arrays temporales de bounds y el almacenamiento de smarttags crudos no usados.
- Gestion escalable: la tabla puede navegar todos los resultados filtrados sin montar todos los rows.
- Visualizacion mas segura: el scatter no intenta crear 100 000 puntos SVG.

Validacion ejecutada: `npm run build` completo y exitoso. El build confirma chunks separados para tabs y worker.

## 4. Segunda fase recomendada

- Sacar los XML masivos del bundle y servirlos desde almacenamiento estatico o API. Aunque ahora cargan lazy, Vite todavia genera chunks XML grandes.
- Migrar el parser a un pipeline incremental/streaming o preprocesar XML a JSON compacto en build/backend.
- Crear un store normalizado por columnas para campos repetidos, con diccionarios de strings e ids numericos para bajar memoria.
- Persistir overrides en IndexedDB o backend, no en `localStorage`, si se espera colaboracion o grandes volumenes.
- Mover agregaciones caras a Worker tambien, especialmente rankings, calidad y series temporales para 100 000+ registros.
- Reemplazar scatter SVG por Canvas/WebGL si se requiere ver todos los puntos espaciales simultaneamente.
- Integrar visor BIM con That Open Company:
  - Usar `@thatopen/components` y `@thatopen/fragments` para cargar modelos IFC/Fragments.
  - Mantener un servicio de seleccion sincronizado: `clashId -> elementIds -> fragment/model ids`.
  - Al seleccionar un clash en la tabla, aislar/resaltar los dos elementos en el visor y mover la camara al punto `pos`.
  - Al seleccionar elementos en el visor, filtrar/centrar la lista de clashes relacionados.
  - Guardar mappings de Navisworks/Revit Element ID a expressId/fragmentId durante conversion del modelo.
  - Ejecutar carga de modelos y conversion a fragments fuera del flujo principal del dashboard.
