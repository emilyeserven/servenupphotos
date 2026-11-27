import assert from "node:assert/strict";
import { test } from "node:test";
import { Gate } from "./gate.js";

test("spaces requests out by the gap", async () => {
  const gate = new Gate(40);
  const start = Date.now();
  await Promise.all([gate.wait(), gate.wait(), gate.wait()]);
  assert.ok(Date.now() - start >= 75, "three requests take at least two gaps");
});

test("a zero gap lets every request through", async () => {
  const gate = new Gate(0);
  const start = Date.now();
  await Promise.all([gate.wait(), gate.wait(), gate.wait()]);
  assert.ok(Date.now() - start < 30);
});

test("an aborted wait rejects with the signal's reason", async () => {
  const gate = new Gate(10_000);
  await gate.wait();
  const controller = new AbortController();
  const waiting = gate.wait(controller.signal);
  controller.abort(new Error("gave up"));
  await assert.rejects(waiting, /gave up/);
});
