import { Readable } from "node:stream";
import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

/** Routes that take a photo upload, with how long each may take on the backend. */
const PHOTO_ROUTES = [
  { path: "/exif", timeoutMs: 60_000 },
  // The backend gives resizing and R2 120s after receiving the photo, so this waits a little longer.
  { path: "/upload", timeoutMs: 150_000 },
  // A resized WEBP version of the photo, as an upload would put in R2.
  { path: "/photos/versions/large", timeoutMs: 60_000 },
  { path: "/photos/versions/medium", timeoutMs: 60_000 },
  { path: "/photos/versions/small", timeoutMs: 60_000 },
] as const;

export const photoRoutes: FastifyPluginAsync = async (app) => {
  // Leave multipart bodies unparsed so the upload streams straight through to the Go backend.
  app.addContentTypeParser("multipart/form-data", (_request, _payload, done) => done(null));

  for (const { path, timeoutMs } of PHOTO_ROUTES) {
    app.post(path, async (request, reply) =>
      relayToBackend(reply, app.log, path, {
        method: "POST",
        headers: { "content-type": request.headers["content-type"] ?? "" },
        body: Readable.toWeb(request.raw) as ReadableStream,
        duplex: "half",
        timeoutMs,
      }),
    );
  }
};
