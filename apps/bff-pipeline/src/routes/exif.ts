import { Readable } from "node:stream";
import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

export const exifRoutes: FastifyPluginAsync = async (app) => {
  // Leave multipart bodies unparsed so the upload streams straight through to the Go backend.
  app.addContentTypeParser("multipart/form-data", (_request, _payload, done) => done(null));

  app.post("/exif", async (request, reply) =>
    relayToBackend(reply, app.log, "/exif", {
      method: "POST",
      headers: { "content-type": request.headers["content-type"] ?? "" },
      body: Readable.toWeb(request.raw) as ReadableStream,
      duplex: "half",
      timeoutMs: 60_000,
    }),
  );
};
