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

  // Looks for a photo in the photo data pull request's files; pages check ALLPHOTOS.json on the
  // base branch from /photos/combined themselves. The backend gives GitHub 30s.
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

  // Replaces one photo JSON file in that pull request with an edit from the Photo page; the backend
  // gives GitHub 30s.
  app.put("/photos/in-flight", async (request, reply) =>
    relayToBackend(reply, app.log, "/photos/in-flight", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      timeoutMs: 35_000,
    }),
  );

  // Reads every photo JSON file on the base branch, the photos already in the portfolio, for the
  // Gallery; the backend gives GitHub 30s, then R2 15s.
  app.get("/photos/published", async (_request, reply) =>
    relayToBackend(reply, app.log, "/photos/published", { timeoutMs: 50_000 }),
  );

  // Reads ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json on the base branch and the photo data
  // pull request, which pages keep until they're committed again; the backend gives GitHub 30s.
  app.get("/photos/combined", async (_request, reply) =>
    relayToBackend(reply, app.log, "/photos/combined", { timeoutMs: 35_000 }),
  );

  // Whether those lists on the pull request have its latest changes, from the newest commit to the
  // data folder; the app checks it once when it starts. The backend gives GitHub 30s.
  app.get("/photos/combined/status", async (_request, reply) =>
    relayToBackend(reply, app.log, "/photos/combined/status", { timeoutMs: 35_000 }),
  );

  // Rebuilds those lists from every data file on the pull request's branch and commits the ones
  // that changed; the backend gives GitHub 60s.
  app.post("/photos/combined", async (_request, reply) =>
    relayToBackend(reply, app.log, "/photos/combined", { method: "POST", timeoutMs: 65_000 }),
  );

  // Reads the EXIF and colors of an original already in R2; the backend gives R2 30s to send it,
  // then reads it as POST /exif does.
  app.post("/photos/bucket/exif", async (request, reply) =>
    relayToBackend(reply, app.log, "/photos/bucket/exif", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      timeoutMs: 90_000,
    }),
  );

  // Lists every image in the R2 bucket; the backend gives R2 30s.
  app.get("/photos/bucket", async (_request, reply) =>
    relayToBackend(reply, app.log, "/photos/bucket", { timeoutMs: 35_000 }),
  );

  // Reads the crop saved with a photo's Square Thumbnail in R2; the backend gives R2 15s.
  app.get<{ Querystring: { key?: string } }>(
    "/photos/bucket/thumbnail-crop",
    async (request, reply) =>
      relayToBackend(
        reply,
        app.log,
        `/photos/bucket/thumbnail-crop?${new URLSearchParams({ key: request.query.key ?? "" })}`,
        { timeoutMs: 20_000 },
      ),
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
