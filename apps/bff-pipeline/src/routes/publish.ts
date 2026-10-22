import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

/** Scheduling photos to publish, for the Publish pages. */
export const publishRoutes: FastifyPluginAsync = async (app) => {
  // Both read every photo JSON file; the backend gives GitHub 60s, so these wait a little longer.
  app.get("/publish/instagram", async (_request, reply) =>
    relayToBackend(reply, app.log, "/publish/instagram", { timeoutMs: 65_000 }),
  );

  app.put("/publish/instagram", async (request, reply) =>
    relayToBackend(reply, app.log, "/publish/instagram", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      timeoutMs: 65_000,
    }),
  );
};
