import type { FastifyBaseLogger, FastifyReply } from "fastify";
import { env } from "../env.js";

/**
 * Forwards a request to the Go backend and relays its response, JSON or otherwise (such as a
 * resized photo). When the backend doesn't answer, it sends a 504 for a timeout, or a 502 saying
 * whether the backend couldn't be reached or dropped the request.
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
    const failure = relayFailure(error, path, timeoutMs);
    return reply.code(failure.status).send({ message: failure.message });
  }
}

/** Why a request to the backend got no answer, as a status and a message fit to show. */
function relayFailure(error: unknown, path: string, timeoutMs: number) {
  if (error instanceof Error && error.name === "TimeoutError") {
    return {
      status: 504,
      message: `The backend didn't answer ${path} within ${Math.round(timeoutMs / 1000)} seconds. It may still be working; its terminal says what it's doing.`,
    };
  }
  const code = errorCode(error);
  if (code === "ECONNREFUSED") {
    return {
      status: 502,
      message: `Couldn't reach the backend at ${env.apiUrl} (connection refused). Is be-pipeline running?`,
    };
  }
  return {
    status: 502,
    message: `The backend stopped answering ${path} (${code}). It may have crashed; its terminal shows why.`,
  };
}

/** The system error code under a failed fetch, such as ECONNREFUSED, or its message. */
function errorCode(error: unknown): string {
  const cause = error instanceof Error ? (error.cause as { code?: string } | undefined) : undefined;
  return cause?.code ?? String(error);
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
