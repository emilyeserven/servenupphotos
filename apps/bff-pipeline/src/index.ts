import { existsSync } from "node:fs";
import fastifyCompress from "@fastify/compress";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { env } from "./env.js";
import { loadBackendTimeouts } from "./lib/backend-timeouts.js";
import { areasRoutes } from "./routes/areas.js";
import { basemapRoutes } from "./routes/basemap.js";
import { healthRoutes } from "./routes/health.js";
import { relayRoutes } from "./routes/relay.js";

const app = Fastify({ logger: true });

// Gzip JSON, scripts and styles (images are already compressed and pass through as they are), so
// the photo lists and the app's code reach a browser on another computer, such as over Tailscale to
// a Raspberry Pi, in a fraction of the bytes. Gzip alone, since brotli costs a Pi far more time.
await app.register(fastifyCompress, { encodings: ["gzip"] });

await app.register(
  async (api) => {
    await api.register(healthRoutes);
    // Answered here, not relayed: routes that need no GitHub, R2 or image work (docs/bff-routes.md).
    await api.register(areasRoutes);
    await api.register(basemapRoutes);
    await api.register(relayRoutes);
  },
  { prefix: "/api" },
);

/** The cache header for a file whose name changes whenever its content does. */
const IMMUTABLE = "public, max-age=31536000, immutable";

/** Whether filePath is one of Vite's built files in assets/, named by a hash of its content. */
function isHashedAsset(filePath: string): boolean {
  return /[\\/]assets[\\/]/.test(filePath);
}

// In production, serve the built client and fall back to index.html for client-side routes.
if (existsSync(env.clientDist)) {
  await app.register(fastifyStatic, {
    root: env.clientDist,
    // Vite names each file in assets/ by a hash of its content, so a browser can keep it for good
    // and open a page without asking the server about its code first. index.html isn't hashed, so
    // it's checked each time, which is how a new deploy's files are found.
    setHeaders: (reply, filePath) => {
      reply.header("cache-control", isHashedAsset(filePath) ? IMMUTABLE : "no-cache");
    },
  });
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

// In the background, so the BFF answers while the backend starts; until then the relay uses its own table.
void loadBackendTimeouts(app.log);
