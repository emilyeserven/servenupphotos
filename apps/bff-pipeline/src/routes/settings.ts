import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

const SECTIONS = ["r2", "github"] as const;

// Settings bodies can carry secrets, so they are relayed as-is and never logged.
export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/settings", async (_request, reply) =>
    relayToBackend(reply, app.log, "/settings", { timeoutMs: 5_000 }),
  );

  for (const section of SECTIONS) {
    app.put(`/settings/${section}`, async (request, reply) =>
      relayToBackend(reply, app.log, `/settings/${section}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
        timeoutMs: 5_000,
      }),
    );
  }

  // Tests the posted (unsaved) settings. The backend gives GitHub 10s, so this waits a little longer.
  app.post("/settings/github/test", async (request, reply) =>
    relayToBackend(reply, app.log, "/settings/github/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body),
      timeoutMs: 15_000,
    }),
  );
};
