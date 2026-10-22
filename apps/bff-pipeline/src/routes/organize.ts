import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

/** Albums and tags, kept as JSON on GitHub, for the Organize pages. */
export const organizeRoutes: FastifyPluginAsync = async (app) => {
  // Reads every album and tag file on the base branch and the photo data pull request; the backend
  // gives GitHub 30s.
  app.get("/organize", async (_request, reply) =>
    relayToBackend(reply, app.log, "/organize", { timeoutMs: 35_000 }),
  );

  // Saves a new album or tag in the photo data pull request; the backend gives GitHub 30s.
  app.post<{ Params: { kind: string } }>("/organize/:kind", async (request, reply) =>
    relayToBackend(reply, app.log, `/organize/${encodeURIComponent(request.params.kind)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      timeoutMs: 35_000,
    }),
  );

  // Moves an album into another, or to the top level, in the photo data pull request.
  app.put<{ Params: { id: string } }>("/organize/albums/:id/parent", async (request, reply) =>
    relayToBackend(
      reply,
      app.log,
      `/organize/albums/${encodeURIComponent(request.params.id)}/parent`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
        timeoutMs: 35_000,
      },
    ),
  );
};
