import { Readable } from "node:stream";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { relayToBackend } from "../lib/backend.js";
import { timeoutFor } from "../lib/timeouts.js";

/**
 * Response headers passed on to the client: thumbnail caching, an upload's JPEG size and quality,
 * and the file name an original JPEG downloads as.
 */
const RELAY_HEADERS = [
  "cache-control",
  "last-modified",
  "x-jpeg-bytes",
  "x-jpeg-quality",
  "content-disposition",
] as const;

/** Whether the request came with a body to pass on, by its headers. */
function hasBody(request: FastifyRequest): boolean {
  const length = request.headers["content-length"];
  return (
    request.headers["transfer-encoding"] !== undefined || (length !== undefined && length !== "0")
  );
}

/** The fetch options that stream the request's body, untouched, to the backend. */
function bodyInit(request: FastifyRequest) {
  if (!hasBody(request)) return {};
  return {
    headers: { "content-type": request.headers["content-type"] ?? "" },
    body: Readable.toWeb(request.raw) as ReadableStream,
    duplex: "half" as const,
  };
}

/**
 * Relays every `/api` request the BFF doesn't answer itself to the same path on the Go backend,
 * with its method, query and body, so a new backend endpoint needs nothing here. Bodies stream
 * through unparsed (JSON, photo uploads and in-flight backups alike), so the backend's own size
 * limits apply. Settings bodies can carry secrets, and they're never logged.
 */
export const relayRoutes: FastifyPluginAsync = async (app) => {
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", (_request, _payload, done) => done(null));

  app.all("/*", async (request, reply) => {
    const path = request.url.replace(/^\/api/, "");
    return relayToBackend(reply, app.log, path, {
      method: request.method,
      ...bodyInit(request),
      timeoutMs: timeoutFor(path),
      relayHeaders: RELAY_HEADERS,
    });
  });
};
