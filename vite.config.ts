import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync } from "node:fs";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: resolve(__dirname, "src/client/routes"),
      generatedRouteTree: resolve(__dirname, "src/client/routeTree.gen.ts"),
    }),
    react(),
    tailwindcss(),
    {
      name: "move-index-html",
      closeBundle() {
        try {
          copyFileSync(
            resolve(__dirname, "dist/client/src/client/index.html"),
            resolve(__dirname, "dist/client/index.html"),
          );
        } catch {}
      },
    },
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  root: resolve(__dirname, "src/client"),
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  appType: "spa",
  build: {
    outDir: resolve(__dirname, "dist/client"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rolldownOptions: {
      input: resolve(__dirname, "src/client/index.html"),
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/]react(-dom)?[\\/]/, priority: 20 },
            { name: "tanstack", test: /node_modules[\\/]@tanstack[\\/]/, priority: 15 },
            { name: "codemirror", test: /node_modules[\\/]@codemirror[\\/]/, priority: 10 },
            { name: "i18n", test: /node_modules[\\/](i18next|react-i18next)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
