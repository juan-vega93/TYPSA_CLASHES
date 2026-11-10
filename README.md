# TYPSA_CLASHES

Dashboard de gestion de clashes para IREN SUR / TYPSA.

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Los cortes se guardan como `src/data/AAMMDD/*.xml`. Usa seis dígitos y coloca los XML directamente dentro de la carpeta de la fecha.

## Publicar un corte en GitHub Pages

Trabaja desde una copia clonada del repositorio; la descarga ZIP no está conectada a GitHub. Si aún no tienes esa copia:

```bash
git clone https://github.com/juan-vega93/TYPSA_CLASHES.git
```

En la copia clonada, actualiza `main` con `git pull --ff-only` antes de copiar el nuevo corte. Por ejemplo, para el corte del 10/11/2026:

```bash
git add -- src/data/261110
git commit -m "Agregar corte del 10 de noviembre"
git push origin main
```

GitHub Actions compila y publica automáticamente. Revisa la ejecución **Deploy GitHub Pages** en la pestaña **Actions** antes de recargar el sitio. No hace falta subir `dist-pages`.

La compilación para Pages comprime los XML sin cambiar su contenido ni el formato de entrada. El navegador carga el último corte al abrir el tablero; los históricos se leen solo para el período solicitado. La compresión reduce tamaño y transferencia, pero el análisis de muchos XML descomprimidos sigue consumiendo memoria y tiempo. Para revisar la semana, selecciona solo los cortes necesarios; si el histórico completo crece mucho, conviene archivarlo fuera de Pages o servirlo mediante un backend.
