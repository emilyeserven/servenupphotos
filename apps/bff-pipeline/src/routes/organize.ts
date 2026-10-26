import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

/** The request options that relay a JSON body with method; the backend gives GitHub 30s. */
function jsonBody(method: "POST" | "PUT", body: unknown) {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    timeoutMs: 35_000,
  };
}

/** Albums, tags and genres, kept as JSON on GitHub, for the Organize pages. */
export const organizeRoutes: FastifyPluginAsync = async (app) => {
  // Reads every album, tag and genre file on the base branch and the photo data pull request; the backend
  // gives GitHub 30s.
  app.get("/organize", async (_request, reply) =>
    relayToBackend(reply, app.log, "/organize", { timeoutMs: 35_000 }),
  );

  // Saves a new album, tag or genre as a change waiting for Commit.
  app.post<{ Params: { kind: string } }>("/organize/:kind", async (request, reply) =>
    relayToBackend(
      reply,
      app.log,
      `/organize/${encodeURIComponent(request.params.kind)}`,
      jsonBody("POST", request.body),
    ),
  );

  // Gives each album its place in the order, as changes waiting for Commit.
  app.put("/organize/albums/order", async (request, reply) =>
    relayToBackend(reply, app.log, "/organize/albums/order", jsonBody("PUT", request.body)),
  );

  // Saves the order of an album's photos, as a change waiting for Commit.
  app.put<{ Params: { id: string } }>("/organize/albums/:id/photo-order", async (request, reply) =>
    relayToBackend(
      reply,
      app.log,
      `/organize/albums/${encodeURIComponent(request.params.id)}/photo-order`,
      jsonBody("PUT", request.body),
    ),
  );

  // Names every tag in lowercase kebab-case, its ID, as changes waiting for Commit.
  app.put("/organize/tags/names", async (request, reply) =>
    relayToBackend(reply, app.log, "/organize/tags/names", jsonBody("PUT", request.body ?? {})),
  );

  // Moves an album into another, or a tag under another, or either to the top level, as a change
  // waiting for Commit.
  app.put<{ Params: { kind: string; id: string } }>(
    "/organize/:kind/:id/parent",
    async (request, reply) =>
      relayToBackend(
        reply,
        app.log,
        `/organize/${encodeURIComponent(request.params.kind)}/${encodeURIComponent(request.params.id)}/parent`,
        jsonBody("PUT", request.body),
      ),
  );

  // Picks the album a spotlight spot shows, as changes waiting for Commit.
  app.put<{ Params: { zone: string } }>("/organize/spotlight/:zone", async (request, reply) =>
    relayToBackend(
      reply,
      app.log,
      `/organize/spotlight/${encodeURIComponent(request.params.zone)}`,
      jsonBody("PUT", request.body),
    ),
  );
};
