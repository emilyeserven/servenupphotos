import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { CombinedData } from "@/api/photos";
import { useCombinedDataStore } from "@/stores/combined-data";

const store = useCombinedDataStore;
const realFetch = globalThis.fetch;
/** The requests the store sent, as "METHOD url". */
let sent: string[] = [];

/** Answers the combined lists' read with lists at pull request number (null for none), and Commit with a commit. */
function answer(number: number | null) {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    sent.push(`${init?.method ?? "GET"} ${url}`);
    if (init?.method === "POST") return Response.json({ sha: "abc" });
    const head = number === null ? null : { pullRequest: { number } };
    return Response.json({ base: {}, head });
  }) as typeof fetch;
}

beforeEach(() => {
  sent = [];
  store.getState().reset();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const change = { kind: "photos", path: "photos/a.json", after: { file: "a.jpg" } } as const;

test("a check of the pull request's head adds the changes the backend kept, before the store's own", () => {
  store.getState().afterSave([change]);
  store.setState({ headState: undefined });
  const kept = {
    kind: "photos" as const,
    path: "photos/b.json",
    before: null,
    after: { file: "b.jpg" },
  };
  const pending = [{ kind: "photos" as const, path: "photos/b.json", change: "added" as const }];
  store
    .getState()
    .headChecked({ state: "stale", pending, changes: [kept, { ...kept, path: change.path }] });
  const state = store.getState();
  assert.deepEqual(
    state.changes.map((c) => c.path),
    ["photos/b.json", "photos/a.json"],
  );
  assert.equal("before" in state.changes[0]!, false);
  assert.deepEqual(state.checked, pending);
  assert.equal(state.headState, "stale");
});

test("a check after a save or a commit started keeps what the store knows better", () => {
  store.getState().afterSave([change]);
  store.setState({ lastCommit: { sha: "abc" } as never });
  store
    .getState()
    .headChecked({ state: "synced", pending: [], changes: [{ ...change, before: null }] });
  const state = store.getState();
  assert.equal(state.changes.length, 1);
  assert.deepEqual(state.checked, []);
  assert.equal(state.headState, "stale");
});

test("the lists are read again for another pull request, once, and not while reading or before the first read", async () => {
  answer(7);
  const { syncPullRequest } = store.getState();
  syncPullRequest({ number: 8 } as never);
  assert.deepEqual(sent, []);
  await store.getState().load();
  assert.equal((store.getState().data as CombinedData).head?.pullRequest.number, 7);
  syncPullRequest({ number: 7 } as never);
  assert.equal(sent.length, 1);
  syncPullRequest({ number: 8 } as never);
  syncPullRequest({ number: 8 } as never);
  assert.equal(sent.length, 2);
  await store.getState().refresh();
  syncPullRequest({ number: 8 } as never);
  syncPullRequest(null);
  assert.equal(store.getState().syncedPull, null);
  assert.equal(sent.length, 4);
});

test("a commit takes the changes it had out and marks the head synced, keeping ones saved since", async () => {
  answer(7);
  await store.getState().load();
  store.getState().afterSave([change]);
  store.getState().afterSave();
  await store.getState().commit();
  let state = store.getState();
  assert.deepEqual(sent, [
    "GET /api/photos/combined",
    "POST /api/photos/combined",
    "GET /api/photos/combined",
  ]);
  assert.deepEqual([state.changes, state.unknownChanges, state.headState], [[], 0, "synced"]);

  store.getState().afterSave([change]);
  const commit = store.getState().commit();
  store.getState().afterSave([{ ...change, path: "photos/c.json" }]);
  await commit;
  state = store.getState();
  assert.deepEqual(
    state.changes.map((c) => c.path),
    ["photos/c.json"],
  );
  assert.equal(state.headState, "stale");
});
