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

  // Reports the "Combine photo data" run for a commit (or the pull request's head when `sha` is
  // absent), so pages know when ALLPHOTOS.json is rebuilt; the backend gives GitHub 30s.
  app.get<{ Querystring: { sha?: string } }>("/photos/in-flight/ci", async (request, reply) => {
    const query = request.query.sha ? `?${new URLSearchParams({ sha: request.query.sha })}` : "";
    return relayToBackend(reply, app.log, `/photos/in-flight/ci${query}`, { timeoutMs: 35_000 });
  });

  // Removes one photo JSON file from that pull request and its image from R2; the backend gives
  // GitHub 30s, then R2 15s.
  app.delete<{ Querystring: { path?: string } }>("/photos/in-flight", async (request, reply) =>
    relayToBackend(
      reply,
      app.log,
      `/photos/in-flight?${new URLSearchParams({ path: request.query.path ?? "" })}`,
      { method: "DELETE", timeoutMs: 50_000 },
    ),
  );

  // Lists every image in the R2 bucket; the backend gives R2 30s.
  app.get("/photos/bucket", async (_request, reply) =>
    relayToBackend(reply, app.log, "/photos/bucket", { timeoutMs: 35_000 }),
  );
};
