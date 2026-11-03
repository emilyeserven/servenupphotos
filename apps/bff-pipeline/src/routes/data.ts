import type { FastifyInstance, FastifyPluginAsync } from "fastify";
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
  relayPosts(
    app,
    [
      "/data/image-base-url/preview",
      "/data/image-base-url",
      "/data/camera-overrides/preview",
      "/data/camera-overrides",
      "/data/location-names/preview",
      "/data/location-names",
      "/data/bulk-tags/untagged",
      "/data/bulk-tags/pick",
      "/data/bulk-tags/preview",
      "/data/bulk-tags",
      "/data/bulk-places/pick",
      "/data/bulk-places",
      "/data/prune-tags/preview",
      "/data/prune-tags",
      "/data/tag-library/export",
      "/data/genre-suggestions/pick",
      "/data/genre-suggestions/preview",
      "/data/genre-suggestions",
      "/data/album-suggestions/pick",
      "/data/album-suggestions/preview",
      "/data/album-suggestions",
    ],
    65_000,
  );

  // The Tag library's answer and save can list a change for every tag and photo, so they may be
  // larger than Fastify's 1 MB default; the backend takes up to 4 MB.
  relayPosts(app, ["/data/tag-library/preview", "/data/tag-library"], 65_000, 4 * 1024 * 1024);

  // Each reads every photo JSON file, and may download originals from R2 to read their EXIF; the
  // backend gives that 3 minutes.
  relayPosts(app, ["/data/missing-fields/preview", "/data/missing-fields"], 190_000);

  // Each lists the bucket and reads every photo JSON file, and renaming copies each renamed photo's
  // images in R2; the backend gives that 5 minutes.
  relayPosts(app, ["/data/image-names/preview", "/data/image-names"], 310_000);

  // Each reads every photo JSON file and downloads the originals from R2 to read their colors; the
  // backend gives that 5 minutes.
  relayPosts(app, ["/data/colors/preview", "/data/colors"], 310_000);
};

/**
 * Relays a JSON POST to each of paths on the backend, waiting up to timeoutMs for its answer, with
 * a body of up to bodyLimit bytes (Fastify's 1 MB when not given).
 */
function relayPosts(app: FastifyInstance, paths: string[], timeoutMs: number, bodyLimit?: number) {
  for (const path of paths) {
    app.post(path, { bodyLimit }, async (request, reply) =>
      relayToBackend(reply, app.log, path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
        timeoutMs,
      }),
    );
  }
}
