import assert from "node:assert/strict";
import { test } from "node:test";
import { viewerId, viewerNamed } from "@/api/viewer-likes";

const dk = { id: "dk", name: "DK", photos: [1] };

test("a name that makes a saved person's ID gets an ID of its own", () => {
  assert.equal(viewerId("dk", [dk]), "dk-2");
  assert.equal(viewerId("DK!", [dk]), "dk-2");
  assert.equal(viewerId("dk", [dk, { ...dk, id: "dk-2" }]), "dk-3");
  assert.equal(viewerId("Jane", [dk]), "jane");
});

test("only the same name is the same person", () => {
  assert.equal(viewerNamed(" DK ", [dk]), dk);
  assert.equal(viewerNamed("D.K.", [dk]), undefined);
  assert.equal(viewerNamed("dk", [dk]), undefined);
});

test("a person renamed after they were added keeps their ID, and a new person with their old name gets another", () => {
  // DK was first saved as "ES", so their ID is still `es`.
  const renamed = { id: "es", name: "DK", photos: [1] };
  assert.equal(viewerNamed("ES", [renamed]), undefined);
  assert.equal(viewerId("ES", [renamed]), "es-2");
});
