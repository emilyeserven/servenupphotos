import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

export const helloRoutes: FastifyPluginAsync = async (app) => {
  app.get("/hello", async (_request, reply) =>
    relayToBackend(reply, app.log, "/hello", { timeoutMs: 5_000 }),
  );
};
