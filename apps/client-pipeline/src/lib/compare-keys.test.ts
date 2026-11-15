import assert from "node:assert/strict";
import { test } from "node:test";
import { compareKeyAction, steppedPath } from "@/lib/compare-keys";

function key(
  name: string,
  mods: Partial<Record<"altKey" | "ctrlKey" | "metaKey" | "shiftKey", boolean>> = {},
) {
  return { key: name, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...mods };
}

test("arrow keys step to the previous or next photo", () => {
  assert.deepEqual(compareKeyAction(key("ArrowLeft")), { kind: "step", step: -1 });
  assert.deepEqual(compareKeyAction(key("ArrowRight")), { kind: "step", step: 1 });
  assert.equal(compareKeyAction(key("ArrowRight", { metaKey: true })), null);
});

test("W picks the winner and L flips Lower Tier, in either case", () => {
  assert.deepEqual(compareKeyAction(key("w")), { kind: "winner" });
  assert.deepEqual(compareKeyAction(key("W", { shiftKey: true })), { kind: "winner" });
  assert.deepEqual(compareKeyAction(key("l")), { kind: "lowerTier" });
  assert.equal(compareKeyAction(key("w", { ctrlKey: true })), null);
  assert.equal(compareKeyAction(key("x")), null);
});

test("stepping goes round the group", () => {
  const paths = ["a", "b", "c"];
  assert.equal(steppedPath(paths, "a", 1), "b");
  assert.equal(steppedPath(paths, "c", 1), "a");
  assert.equal(steppedPath(paths, "a", -1), "c");
  assert.equal(steppedPath(paths, "z", 1), "z");
});
