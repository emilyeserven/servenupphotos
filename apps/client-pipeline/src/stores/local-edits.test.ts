import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { useLocalEditsStore } from "@/stores/local-edits";

const store = useLocalEditsStore;
beforeEach(() => store.getState().discard());

const before = { title: "Gate", socialMediaPublishDate: null };

test("setting a field keeps an edit of the file, with the file as read", () => {
  store
    .getState()
    .setField("socialMediaPublishDate", [{ path: "a.json", before, value: "2026-12-01" }]);
  assert.deepEqual(store.getState().edits, {
    "a.json": {
      kind: "photos",
      path: "a.json",
      before,
      fields: { socialMediaPublishDate: "2026-12-01" },
    },
  });
});

test("setting a field back to the file's own value drops it, and the edit with no fields left", () => {
  const { setField } = store.getState();
  setField("socialMediaPublishDate", [{ path: "a.json", before, value: "2026-12-01" }]);
  setField("title", [{ path: "a.json", before, value: "New" }]);
  setField("socialMediaPublishDate", [{ path: "a.json", before, value: null }]);
  assert.deepEqual(store.getState().edits["a.json"]?.fields, { title: "New" });
  setField("title", [{ path: "a.json", before, value: "Gate" }]);
  assert.deepEqual(store.getState().edits, {});
});

test("a renamed file's edit moves with it, dropping fields the save already has", () => {
  const { setField, moved } = store.getState();
  setField("title", [{ path: "a.json", before, value: "New" }]);
  setField("socialMediaPublishDate", [{ path: "a.json", before, value: "2026-12-01" }]);
  moved("a.json", "new.json", { title: "New", socialMediaPublishDate: null });
  assert.deepEqual(store.getState().edits, {
    "new.json": {
      kind: "photos",
      path: "new.json",
      before: { title: "New", socialMediaPublishDate: null },
      fields: { socialMediaPublishDate: "2026-12-01" },
    },
  });
  moved("new.json", "b.json", { socialMediaPublishDate: "2026-12-01" });
  assert.deepEqual(store.getState().edits, {});
});

test("a commit drops the edits it saved and keeps ones made while it ran", () => {
  const { setField } = store.getState();
  setField("title", [{ path: "a.json", before, value: "New" }]);
  const saved = store.getState().edits;
  setField("title", [{ path: "b.json", before, value: "Other" }]);
  store.getState().committed(saved);
  assert.deepEqual(Object.keys(store.getState().edits), ["b.json"]);
});
