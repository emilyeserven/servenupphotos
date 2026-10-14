import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    // In dev, the BFF (bff-pipeline) runs separately; in prod it serves this build itself.
    // BFF_URL is set by docker-compose.dev.yml, where the BFF is another container.
    proxy: {
      "/api": process.env.BFF_URL ?? "http://localhost:8080",
    },
  },
});
