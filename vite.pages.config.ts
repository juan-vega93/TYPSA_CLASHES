import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { gzipSync } from "node:zlib";

export default defineConfig({
  root: "pages",
  publicDir: "../public",
  base: process.env.GITHUB_PAGES === "true" ? "/TYPSA_CLASHES/" : "/",
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
    {
      name: "compress-published-xml",
      apply: "build",
      generateBundle(_, bundle) {
        for (const entry of Object.values(bundle)) {
          if (entry.type === "asset" && entry.fileName.endsWith(".xml.gz"))
            entry.source = gzipSync(entry.source);
        }
      },
    },
  ],
  build: {
    outDir: "../dist-pages",
    emptyOutDir: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        assetFileNames: ({ names }) =>
          names.some((name) => /\.xml$/i.test(name))
            ? "assets/[name]-[hash].xml.gz"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
});
