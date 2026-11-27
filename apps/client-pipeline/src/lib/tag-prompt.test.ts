import assert from "node:assert/strict";
import { test } from "node:test";
import type { Group, OrganizeResponse } from "@/api/organize";
import { matchTags, parseDefinitions } from "@/lib/tag-prompt";

test("the LLM's definitions are read by tag ID, with the parent tag a line names", () => {
  const answer = [
    "shotengai, sunset",
    "",
    "- Shotengai: a Japanese shopping street (parent: Covered Street)",
    "Torii: a shrine gate",
    "no definition here",
  ].join("\n");
  assert.deepEqual(parseDefinitions(answer), {
    shotengai: { definition: "a Japanese shopping street", parent: "covered-street" },
    torii: { definition: "a shrine gate" },
  });
  assert.deepEqual(parseDefinitions("torii: a gate (parent: !!)"), {
    torii: { definition: "a gate" },
  });
});

/** A group with this name and its ID. */
function group(name: string): Group {
  return { id: name.toLowerCase().replace(/\s+/g, "-"), name } as Group;
}

const organize = {
  albums: [group("Japan")],
  tags: [group("Sunset")],
  genres: [group("Street")],
} as unknown as OrganizeResponse;

test("pasted names are sorted into existing tags, new ones, and ones that can't be tags", () => {
  const result = matchTags(
    ["sunset", "Sunset", "Night Market", "night market", "japan", "STREET", "Cameras", "!!!"],
    organize,
    [{ name: "cameras" }] as never,
  );
  assert.deepEqual(result.existing, ["sunset"]);
  assert.deepEqual(result.fresh, ["night-market"]);
  assert.deepEqual(result.skipped, [
    { name: "japan", reason: "an album has that name" },
    { name: "STREET", reason: "a genre has that name" },
    { name: "Cameras", reason: "a metadata group has that name" },
    { name: "!!!", reason: "it has no letter or number from a to z or 0 to 9 to make an ID from" },
  ]);
});
