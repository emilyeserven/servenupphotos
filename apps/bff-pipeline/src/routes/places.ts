import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

/**
 * Places, localizations, metadata groups and camera overrides, kept as JSON on GitHub, for the
 * Places, Localizations, Metadata Groups and Camera Overrides pages.
 */
export const placesRoutes: FastifyPluginAsync = async (app) => {
  // Reads every place and localization file in the photo data pull request; the backend gives
  // GitHub 30s.
  app.get("/places", async (_request, reply) =>
    relayToBackend(reply, app.log, "/places", { timeoutMs: 35_000 }),
  );

  // Saves a place, a localization, a metadata group (combined into METAINFO.json) or a camera
  // override (CAMERAS.json), new or changed, as a change waiting for Commit.
  for (const kind of ["places", "localizations", "metainfo", "cameras"]) {
    app.put<{ Params: { id: string } }>(`/${kind}/:id`, async (request, reply) =>
      relayToBackend(reply, app.log, `/${kind}/${encodeURIComponent(request.params.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
        timeoutMs: 35_000,
      }),
    );
  }

  // Removes a metadata group or a camera override as a change waiting for Commit.
  for (const kind of ["metainfo", "cameras"]) {
    app.delete<{ Params: { id: string } }>(`/${kind}/:id`, async (request, reply) =>
      relayToBackend(reply, app.log, `/${kind}/${encodeURIComponent(request.params.id)}`, {
        method: "DELETE",
        timeoutMs: 35_000,
      }),
    );
  }
};
