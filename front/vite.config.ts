import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "OzonPatch",
      formats: ["iife"],
      fileName: () => "tilda-map-patch.js",
    },
    outDir: resolve(__dirname, "../src/scripts"),
    emptyOutDir: false,
    minify: true,
    rollupOptions: {
      output: {
        // Один файл без chunk-splitting
        inlineDynamicImports: true,
      },
    },
  },
});
