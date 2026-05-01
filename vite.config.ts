import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

export default defineConfig({
  plugins: [
    devServer({
      entry: resolve(__dirname, "src/index.ts"),
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/client/index.html"),
    },
  },
});
