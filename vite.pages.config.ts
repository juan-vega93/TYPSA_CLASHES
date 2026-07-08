import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  root: "pages",
  publicDir: "../public",
  base: process.env.GITHUB_PAGES === "true" ? "/TYPSA_CLASHES/" : "/",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: "../dist-pages",
    emptyOutDir: true,
  },
});
