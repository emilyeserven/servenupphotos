import { setTimeout as sleep } from "node:timers/promises";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../env.js";
import { type RelayTimeouts, setRelayTimeouts } from "./timeouts.js";

/** How much longer than the backend gives a path the BFF waits, so the backend's own error arrives first. */
const MARGIN_MS = 5_000;

/** How many times to ask, and how long to wait between, while the backend starts. */
const ATTEMPTS = 15;
const RETRY_MS = 2_000;

/** The answer of the backend's GET /timeouts: how long it may spend on each path, in seconds. */
interface BackendTimeouts {
  defaultSeconds: number;
  prefixes: Record<string, number>;
}

/** The BFF's waits for the backend's times: each a margin longer, in ms. */
function relayTimeouts(backend: BackendTimeouts): RelayTimeouts {
  const waitMs = (seconds: number) => seconds * 1000 + MARGIN_MS;
  const prefixes = Object.fromEntries(
    Object.entries(backend.prefixes).map(([prefix, seconds]) => [prefix, waitMs(seconds)]),
  );
  return { defaultMs: waitMs(backend.defaultSeconds), prefixes };
}

/** Asks the backend once for its times; undefined when it doesn't answer them. */
async function fetchBackendTimeouts(): Promise<BackendTimeouts | undefined> {
  const res = await fetch(`${env.apiUrl}/timeouts`, { signal: AbortSignal.timeout(2_000) }).catch(
    () => undefined,
  );
  if (!res?.ok) return undefined;
  const body: unknown = await res.json().catch(() => undefined);
  return isBackendTimeouts(body) ? body : undefined;
}

/** Whether body has the shape of the backend's GET /timeouts answer. */
function isBackendTimeouts(body: unknown): body is BackendTimeouts {
  const { defaultSeconds, prefixes } = (body ?? {}) as Partial<BackendTimeouts>;
  return typeof defaultSeconds === "number" && typeof prefixes === "object" && prefixes !== null;
}

/**
 * Reads how long the backend may spend on each path from its GET /timeouts, asking again while it
 * starts, and has the relay wait a little longer than each. When the backend never answers (or is
 * older and has no such route), the relay keeps its hand-written waits and the log says so.
 */
export async function loadBackendTimeouts(log: FastifyBaseLogger) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const backend = await fetchBackendTimeouts();
    if (backend) {
      setRelayTimeouts(relayTimeouts(backend));
      log.info({ paths: Object.keys(backend.prefixes).length }, "using the backend's timeouts");
      return;
    }
    await sleep(RETRY_MS);
  }
  log.warn("the backend didn't answer GET /timeouts; using the BFF's own table");
}
