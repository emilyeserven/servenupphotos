import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

export const githubRoutes: FastifyPluginAsync = async (app) => {
  // The backend gives GitHub 30s across its several calls, so this waits a little longer.
  app.post("/photos/github", async (request, reply) =>
    relayToBackend(reply, app.log, "/photos/github", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      timeoutMs: 35_000,
    }),
  );

  // Reads the photo JSON in the open "Add photo data" pull request; the backend gives GitHub 30s.
  app.get("/photos/in-flight", async (_request, reply) =>
    relayToBackend(reply, app.log, "/photos/in-flight", { timeoutMs: 35_000 }),
  );
};
