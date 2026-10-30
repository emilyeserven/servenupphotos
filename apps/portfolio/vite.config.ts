import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = path.resolve(import.meta.dirname, "../..");
/** How long after one refresh the next page load waits before refreshing again. */
const REFRESH_EVERY_MS = 10_000;

/**
 * In dev, refreshes the local photo, place and localization data from the photo pipeline, when
 * it's running, before serving each page load (at most every 10 seconds), so a reload shows what
 * was just saved in the pipeline. See scripts/combine-photo-data.mjs.
 */
function localPhotoData(): Plugin {
  let last = 0;
  const refresh = promisify(execFile).bind(null, process.execPath, [
    path.join(root, "scripts/combine-photo-data.mjs"),
    "--pipeline-only",
    "--quiet",
  ]);
  return {
    name: "local-photo-data",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.headers.accept?.includes("text/html") || Date.now() - last < REFRESH_EVERY_MS) {
          return next();
        }
        last = Date.now();
        refresh({ cwd: root })
          .catch((err: Error) => server.config.logger.warn(`Local photo data: ${err.message}`))
          .finally(next);
      });
    },
  };
}

// Served from the root of the custom domain https://servenupphotos.net on GitHub Pages.
export default defineConfig({
  base: "/",
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    localPhotoData(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // The files the pipeline's Gallery shares (its filters) import each other by this name, which
      // means the same folder in both apps; see docs/gallery.md.
      "@portfolio": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
