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

  // Looks for a photo in ALLPHOTOS.json on the base branch and the photo data pull request; the
  // backend gives GitHub 30s.
  app.post("/photos/all-photos/check", async (request, reply) =>
    relayToBackend(reply, app.log, "/photos/all-photos/check", {
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

  // Remakes resized versions of a photo already in R2 from its original; the backend gives
  // downloading, resizing and uploading 120s, so this waits a little longer.
  app.post("/photos/bucket/versions", async (request, reply) =>
    relayToBackend(reply, app.log, "/photos/bucket/versions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      timeoutMs: 150_000,
    }),
  );
};
