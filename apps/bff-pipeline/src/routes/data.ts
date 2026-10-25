import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

/** Bulk changes to the photo JSON on GitHub, for the Update Data page. */
export const dataRoutes: FastifyPluginAsync = async (app) => {
  // How far a Missing fields or Colors read has got, which the page asks while it runs. The backend
  // answers from memory.
  app.get<{ Params: { task: string } }>("/data/progress/:task", async (request, reply) =>
    relayToBackend(reply, app.log, `/data/progress/${encodeURIComponent(request.params.task)}`, {
      timeoutMs: 5_000,
    }),
  );

  // Each reads every photo JSON file; the backend gives GitHub 60s, so these wait a little longer.
  for (const path of [
    "/data/image-base-url/preview",
    "/data/image-base-url",
    "/data/camera-overrides/preview",
    "/data/camera-overrides",
    "/data/location-names/preview",
    "/data/location-names",
    "/data/bulk-tags/pick",
    "/data/bulk-tags/preview",
    "/data/bulk-tags",
  ]) {
    app.post(path, async (request, reply) =>
      relayToBackend(reply, app.log, path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
        timeoutMs: 65_000,
      }),
    );
  }

  // Each reads every photo JSON file, and may download originals from R2 to read their EXIF; the
  // backend gives that 3 minutes.
  for (const path of ["/data/missing-fields/preview", "/data/missing-fields"]) {
    app.post(path, async (request, reply) =>
      relayToBackend(reply, app.log, path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
        timeoutMs: 190_000,
      }),
    );
  }

  // Each reads every photo JSON file and downloads the originals from R2 to read their colors; the
  // backend gives that 5 minutes.
  for (const path of ["/data/colors/preview", "/data/colors"]) {
    app.post(path, async (request, reply) =>
      relayToBackend(reply, app.log, path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
        timeoutMs: 310_000,
      }),
    );
  }
};
