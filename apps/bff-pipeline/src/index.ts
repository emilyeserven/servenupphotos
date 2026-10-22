import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { env } from "./env.js";
import { dataRoutes } from "./routes/data.js";
import { githubRoutes } from "./routes/github.js";
import { photoRoutes } from "./routes/photos.js";
import { publishRoutes } from "./routes/publish.js";
import { healthRoutes } from "./routes/health.js";
import { helloRoutes } from "./routes/hello.js";
import { settingsRoutes } from "./routes/settings.js";

const app = Fastify({ logger: true });

await app.register(
  async (api) => {
    await api.register(healthRoutes);
    await api.register(helloRoutes);
    await api.register(photoRoutes);
    await api.register(githubRoutes);
    await api.register(settingsRoutes);
    await api.register(dataRoutes);
    await api.register(publishRoutes);
  },
  { prefix: "/api" },
);

// In production, serve the built client and fall back to index.html for client-side routes.
if (existsSync(env.clientDist)) {
  await app.register(fastifyStatic, { root: env.clientDist });
  app.setNotFoundHandler((request, reply) => {
    if (request.method === "GET" && !request.url.startsWith("/api")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ message: "Not found" });
  });
}

try {
  await app.listen({ host: env.host, port: env.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
