import type { FastifyPluginAsync } from "fastify";
import { env } from "../env.js";

export const helloRoutes: FastifyPluginAsync = async (app) => {
  app.get("/hello", async (_request, reply) => {
    try {
      const res = await fetch(`${env.apiUrl}/hello`, { signal: AbortSignal.timeout(5_000) });
      return reply.code(res.status).send(await res.json());
    } catch (error) {
      app.log.error(error, "be-pipeline request failed");
      return reply.code(502).send({ message: "Backend unreachable" });
    }
  });
};
