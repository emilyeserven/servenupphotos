import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

/** Bulk changes to the photo JSON on GitHub, for the Update Data page. */
export const dataRoutes: FastifyPluginAsync = async (app) => {
  // Each reads every photo JSON file; the backend gives GitHub 60s, so these wait a little longer.
  for (const path of ["/data/image-base-url/preview", "/data/image-base-url"]) {
    app.post(path, async (request, reply) =>
      relayToBackend(reply, app.log, path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
        timeoutMs: 65_000,
      }),
    );
  }
};
