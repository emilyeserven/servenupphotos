import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

/**
 * Places, localizations and metadata groups, kept as JSON on GitHub, for the Places,
 * Localizations and Metadata Groups pages.
 */
export const placesRoutes: FastifyPluginAsync = async (app) => {
  // Reads every place and localization file in the photo data pull request; the backend gives
  // GitHub 30s.
  app.get("/places", async (_request, reply) =>
    relayToBackend(reply, app.log, "/places", { timeoutMs: 35_000 }),
  );

  // Saves a place, a localization or a metadata group (combined into METAINFO.json), new or
  // changed, as a change waiting for Commit.
  for (const kind of ["places", "localizations", "metainfo"]) {
    app.put<{ Params: { id: string } }>(`/${kind}/:id`, async (request, reply) =>
      relayToBackend(reply, app.log, `/${kind}/${encodeURIComponent(request.params.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
        timeoutMs: 35_000,
      }),
    );
  }

  // Removes a metadata group as a change waiting for Commit.
  app.delete<{ Params: { id: string } }>("/metainfo/:id", async (request, reply) =>
    relayToBackend(reply, app.log, `/metainfo/${encodeURIComponent(request.params.id)}`, {
      method: "DELETE",
      timeoutMs: 35_000,
    }),
  );
};
