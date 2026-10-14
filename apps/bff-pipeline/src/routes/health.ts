import type { FastifyPluginAsync } from "fastify";
import { env } from "../env.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    const backend = await fetch(`${env.apiUrl}/health`, { signal: AbortSignal.timeout(2_000) })
      .then((res) => (res.ok ? "ok" : "unreachable"))
      .catch(() => "unreachable" as const);

    return {
      status: backend === "ok" ? "ok" : "degraded",
      bff: "ok",
      backend,
    };
  });
};
