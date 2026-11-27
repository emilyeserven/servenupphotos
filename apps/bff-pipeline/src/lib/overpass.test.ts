import assert from "node:assert/strict";
import { test } from "node:test";
import { Gate } from "./gate.js";
import { BusyError, OverpassClient, overpassUrls, SlowError, StatusError } from "./overpass.js";

/** An Overpass client whose servers answer with answer(url), recording each server asked. */
function servers(
  answer: (url: string) => Response | Promise<Response>,
  urls = ["http://one/api", "http://two/api"],
) {
  const asked: string[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    asked.push(url);
    if (init.signal?.aborted) throw init.signal.reason;
    return answer(url);
  }) as unknown as typeof globalThis.fetch;
  return { client: new OverpassClient({ urls, waitsMs: [0], gate: new Gate(0), fetch }), asked };
}

const ok = () => new Response(JSON.stringify({ elements: [{ type: "relation", id: 1 }] }));

test("falls back to the next server when one is busy", async () => {
  const { client, asked } = servers((url) =>
    url.includes("one") ? new Response("", { status: 504 }) : ok(),
  );
  assert.equal((await client.query("q")).length, 1);
  assert.deepEqual(asked, ["http://one/api", "http://two/api"]);
});

test("gives up as busy after two rounds of every server", async () => {
  const { client, asked } = servers(() => new Response("", { status: 429 }));
  const error = await client.query("q").catch((e: unknown) => e);
  assert.ok(error instanceof BusyError);
  assert.equal(asked.length, 4);
  assert.equal(error.server, "two");
  assert.ok(error.last instanceof StatusError && error.last.status === "429 Too Many Requests");
});

test("doesn't try again when the query is turned down as wrong", async () => {
  const { client, asked } = servers(
    () => new Response("", { status: 400, statusText: "Bad Request" }),
  );
  await assert.rejects(client.query("q"), /answered 400 Bad Request/);
  assert.equal(asked.length, 1);
});

test("an answer that isn't JSON counts as a failed try", async () => {
  const { client, asked } = servers((url) => (url.includes("one") ? new Response("<html>") : ok()));
  assert.equal((await client.query("q")).length, 1);
  assert.equal(asked.length, 2);
});

test("running out of time after a try counts as busy", async () => {
  const { client } = servers(() => new Response("", { status: 503 }));
  const error = await client.query("q", AbortSignal.timeout(1)).catch((e: unknown) => e);
  assert.ok(
    error instanceof BusyError ||
      error instanceof SlowError ||
      (error as Error).name === "TimeoutError",
  );
});

test("keeps answers, so the same query asks once", async () => {
  const { client, asked } = servers(ok);
  await client.query("q");
  await client.query("q");
  assert.equal(asked.length, 1);
});

test("reads the servers from OVERPASS_URL, or else the public ones", () => {
  assert.deepEqual(overpassUrls(" http://a , ,http://b"), ["http://a", "http://b"]);
  assert.equal(overpassUrls("").length, 3);
});
