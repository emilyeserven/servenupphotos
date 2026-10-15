import type { FastifyBaseLogger, FastifyReply } from "fastify";
import { env } from "../env.js";

/** Forwards a request to the Go backend and relays its JSON response, or a 502 if it is unreachable. */
export async function relayToBackend(
  reply: FastifyReply,
  log: FastifyBaseLogger,
  path: string,
  init: RequestInit & { timeoutMs: number },
) {
  const { timeoutMs, ...rest } = init;
  try {
    const res = await fetch(`${env.apiUrl}${path}`, {
      ...rest,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return reply.code(res.status).send(await res.json());
  } catch (error) {
    log.error(error, "be-pipeline request failed");
    return reply.code(502).send({ message: "Backend unreachable" });
  }
}
