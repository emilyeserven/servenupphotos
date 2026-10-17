import type { FastifyBaseLogger, FastifyReply } from "fastify";
import { env } from "../env.js";

/**
 * Forwards a request to the Go backend and relays its response, JSON or otherwise (such as a
 * resized photo), or a 502 if it is unreachable.
 */
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
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.startsWith("application/json")) {
      return reply.code(res.status).send(await res.json());
    }
    return reply
      .code(res.status)
      .type(contentType)
      .send(Buffer.from(await res.arrayBuffer()));
  } catch (error) {
    log.error(error, "be-pipeline request failed");
    return reply.code(502).send({ message: "Backend unreachable" });
  }
}
