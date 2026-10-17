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
  init: RequestInit & {
    timeoutMs: number;
    /** Response headers to pass on to the client, besides the content type. */
    relayHeaders?: readonly string[];
  },
) {
  const { timeoutMs, relayHeaders = [], ...rest } = init;
  try {
    const res = await fetch(`${env.apiUrl}${path}`, {
      ...rest,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return await sendResponse(reply, res, relayHeaders);
  } catch (error) {
    log.error(error, "be-pipeline request failed");
    return reply.code(502).send({ message: "Backend unreachable" });
  }
}

/** Sends the backend's response on: its status, the named headers, and its body as JSON or bytes. */
async function sendResponse(reply: FastifyReply, res: Response, relayHeaders: readonly string[]) {
  copyHeaders(reply, res, relayHeaders);
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.startsWith("application/json")) {
    return reply.code(res.status).send(await res.json());
  }
  return reply
    .code(res.status)
    .type(contentType)
    .send(Buffer.from(await res.arrayBuffer()));
}

function copyHeaders(reply: FastifyReply, res: Response, names: readonly string[]) {
  for (const name of names) {
    const value = res.headers.get(name);
    if (value !== null) reply.header(name, value);
  }
}
