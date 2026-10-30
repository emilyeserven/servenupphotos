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
      // The portfolio's Grid filters, which the Gallery shows too; see docs/gallery.md.
      "@portfolio": path.resolve(import.meta.dirname, "../portfolio/src"),
    },
    // The portfolio's files take these from this app, so there's one React and one router, and the
    // Docker images needn't install the portfolio's packages.
    dedupe: [
      "react",
      "react-dom",
      "@tanstack/react-router",
      "radix-ui",
      "lucide-react",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
    ],
  },
  server: {
    // In dev, the BFF (bff-pipeline) runs separately; in prod it serves this build itself.
    // BFF_URL is set by docker-compose.dev.yml, where the BFF is another container.
    proxy: {
      "/api": process.env.BFF_URL ?? "http://localhost:8080",
    },
  },
});
