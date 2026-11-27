import type { FastifyPluginAsync } from "fastify";
import { env } from "../env.js";
import { AreaFinder } from "../lib/area-finder.js";
import { answerAreaSearch, searchOf } from "../lib/area-search.js";

/**
 * `GET /api/areas?q=`: the areas with an outline on OpenStreetMap matching a name or a Wikidata ID,
 * answered here rather than by the Go backend (see docs/bff-routes.md).
 */
export const areasRoutes: FastifyPluginAsync = async (app) => {
  const finder = new AreaFinder({ nominatimUrl: env.nominatimUrl, wikidataUrl: env.wikidataUrl });
  app.get("/areas", async (request, reply) => {
    const answer = await answerAreaSearch(
      (q, signal) => finder.find(q, signal),
      searchOf(request.query),
    );
    return reply.code(answer.status).send(answer.body);
  });
};
