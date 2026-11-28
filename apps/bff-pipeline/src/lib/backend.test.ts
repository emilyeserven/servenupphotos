import assert from "node:assert/strict";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import Fastify from "fastify";
import { env } from "../env.js";
import { relayToBackend } from "./backend.js";

/** A backend that starts sending a PDF, then drops the connection part way through. */
function droppingBackend(): Promise<Server> {
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "application/pdf",
      "content-length": "100000",
      "content-disposition": 'attachment; filename="korea.pdf"',
    });
    response.write("%PDF-1.4 part");
    setTimeout(() => response.destroy(), 20);
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

test("a backend that drops a PDF part way says so as JSON, not a PDF", async () => {
  const backend = await droppingBackend();
  const { port } = backend.address() as AddressInfo;
  const apiUrl = env.apiUrl;
  env.apiUrl = `http://127.0.0.1:${port}`;
  const app = Fastify();
  app.post("/pdf", (_request, reply) =>
    relayToBackend(reply, app.log, "/photobooks/korea/pdf", {
      method: "POST",
      timeoutMs: 5000,
      relayHeaders: ["content-disposition"],
    }),
  );
  try {
    const res = await app.inject({ method: "POST", url: "/pdf" });
    assert.equal(res.statusCode, 502);
    assert.match(res.headers["content-type"] ?? "", /^application\/json/);
    assert.equal(res.headers["content-disposition"], undefined);
    assert.match(res.json().message, /^The backend stopped answering \/photobooks\/korea\/pdf/);
  } finally {
    env.apiUrl = apiUrl;
    await app.close();
    backend.close();
  }
});
