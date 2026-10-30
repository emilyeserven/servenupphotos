import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

/** The backend path with the request's `?refresh=1`, which makes it ask GitHub again. */
function withRefresh(path: string, query: { refresh?: string }): string {
  return query.refresh ? `${path}?refresh=1` : path;
}

export const githubRoutes: FastifyPluginAsync = async (app) => {
  // Saves a photo's data as a change waiting for Commit. The backend may read the photo's colors
  // from R2 first, given 20s, then read GitHub, given 30s, so this waits a little longer.
  app.post("/photos/github", async (request, reply) =>
    relayToBackend(reply, app.log, "/photos/github", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      timeoutMs: 55_000,
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

  // Reads the photo JSON in the open "Add photo data" pull request and the changes waiting for
  // Commit; the backend gives GitHub 30s. `?refresh=1` makes it ask GitHub instead of using what it
  // read when it started.
  app.get<{ Querystring: { refresh?: string } }>("/photos/in-flight", async (request, reply) =>
    relayToBackend(reply, app.log, withRefresh("/photos/in-flight", request.query), {
      timeoutMs: 35_000,
    }),
  );

  // Removes one photo JSON file waiting for Commit and its image from R2; the backend gives GitHub
  // 30s, then R2 15s.
  app.delete<{ Querystring: { path?: string } }>("/photos/in-flight", async (request, reply) =>
    relayToBackend(
      reply,
      app.log,
      `/photos/in-flight?${new URLSearchParams({ path: request.query.path ?? "" })}`,
      { method: "DELETE", timeoutMs: 50_000 },
    ),
  );

  // Saves an edit of one photo JSON file from the Photo page as a change waiting for Commit; the
  // backend gives GitHub 30s.
  app.put("/photos/in-flight", async (request, reply) =>
    relayToBackend(reply, app.log, "/photos/in-flight", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      timeoutMs: 35_000,
    }),
  );

  // Adds albums and tags to several photo files, from the Gallery, as changes waiting for Commit;
  // the backend reads every photo file and gives GitHub 60s.
  app.post("/photos/groups", async (request, reply) =>
    relayToBackend(reply, app.log, "/photos/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      timeoutMs: 65_000,
    }),
  );

  // Reads every photo JSON file on the base branch, the photos already in the portfolio, for the
  // Gallery; the backend gives GitHub 30s, then R2 15s.
  app.get("/photos/published", async (_request, reply) =>
    relayToBackend(reply, app.log, "/photos/published", { timeoutMs: 50_000 }),
  );

  // Reads ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json on the base branch and the photo data
  // pull request, which pages keep until they're committed again; the backend gives GitHub 30s.
  app.get<{ Querystring: { refresh?: string } }>("/photos/combined", async (request, reply) =>
    relayToBackend(reply, app.log, withRefresh("/photos/combined", request.query), {
      timeoutMs: 35_000,
    }),
  );

  // Whether those lists on the pull request have its latest changes, and the changes waiting for
  // Commit; the app checks it once when it starts. The backend gives GitHub 30s.
  app.get("/photos/combined/status", async (_request, reply) =>
    relayToBackend(reply, app.log, "/photos/combined/status", { timeoutMs: 35_000 }),
  );

  // Commits every change waiting for Commit and the app's local edits (such as Instagram dates),
  // with those lists rebuilt, as one commit, opening the pull request when none is open; the
  // backend gives GitHub 60s.
  app.post("/photos/combined", async (request, reply) =>
    relayToBackend(reply, app.log, "/photos/combined", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body ?? {}),
      timeoutMs: 65_000,
    }),
  );

  // Drops the changes waiting for Commit, all of them or the body's `paths`; only the backend's
  // own file changes, so this is quick.
  app.delete("/photos/pending", async (request, reply) =>
    relayToBackend(reply, app.log, "/photos/pending", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body ?? {}),
      timeoutMs: 10_000,
    }),
  );

  // The changes waiting for Commit as an in-flight backup; only the backend's own file, so it works
  // offline and is quick.
  app.get("/photos/pending", async (_request, reply) =>
    relayToBackend(reply, app.log, "/photos/pending", { timeoutMs: 10_000 }),
  );

  // Keeps the files in an in-flight backup as changes waiting for Commit; the backend gives GitHub 30s
  // to find the head they're compared with. A backup of many photos is larger than Fastify's 1 MB default.
  app.post("/photos/pending", { bodyLimit: 32 * 1024 * 1024 }, async (request, reply) =>
    relayToBackend(reply, app.log, "/photos/pending", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      timeoutMs: 35_000,
    }),
  );

  // Reads the EXIF and colors of an original already in R2; the backend gives R2 30s to send it,
  // then reads it as POST /exif does, camera overrides included.
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

  // Deletes images from the R2 bucket, for Explore Bucket; the backend gives R2 30s.
  app.post("/photos/bucket/delete", async (request, reply) =>
    relayToBackend(reply, app.log, "/photos/bucket/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      timeoutMs: 35_000,
    }),
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
