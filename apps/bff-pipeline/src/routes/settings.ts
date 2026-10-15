import type { FastifyPluginAsync } from "fastify";
import { relayToBackend } from "../lib/backend.js";

const SECTIONS = ["r2", "github"] as const;
/** Sections whose settings can be checked against the service they connect to. */
const TESTABLE_SECTIONS = ["r2", "github"] as const;

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

  // The backend gives the remote service 10s, so this waits a little longer.
  for (const section of TESTABLE_SECTIONS) {
    app.post(`/settings/${section}/test`, async (request, reply) =>
      relayToBackend(reply, app.log, `/settings/${section}/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request.body),
        timeoutMs: 15_000,
      }),
    );
  }
};
