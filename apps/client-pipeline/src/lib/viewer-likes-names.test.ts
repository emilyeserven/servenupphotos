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
