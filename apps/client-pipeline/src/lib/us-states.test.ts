import assert from "node:assert/strict";
import { test } from "node:test";
import { withStateAbbreviations } from "@/lib/us-states";

test("a US state written out in a state placeholder becomes its abbreviation", () => {
  const values = { state: "California", stateLocalized: "New York", city: "Georgia" };
  assert.deepEqual(withStateAbbreviations(values), {
    state: "CA",
    stateLocalized: "NY",
    city: "Georgia",
  });
});

test("a state that isn't a US state is left as it is", () => {
  assert.deepEqual(withStateAbbreviations({ state: "Ontario" }), { state: "Ontario" });
});
