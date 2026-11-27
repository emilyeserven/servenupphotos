import type { FastifyPluginAsync } from "fastify";
import { env } from "../env.js";

/**
 * `GET /api/basemap`: the CARTO API key the pages fetch basemap tiles with, such as under the Trip
 * Lines page's day cards. CARTO's raster tiles carry an "API key required" watermark without one;
 * "" when CARTO_KEY isn't set, and the pages then draw no basemap. The pipeline only runs on the
 * owner's own machine, so its pages can hold the key.
 */
export const basemapRoutes: FastifyPluginAsync = async (app) => {
  app.get("/basemap", async () => ({ cartoKey: env.cartoKey }));
};
