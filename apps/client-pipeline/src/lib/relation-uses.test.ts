import assert from "node:assert/strict";
import { test } from "node:test";
import { relationUses } from "@/lib/relation-uses";

const photo = (country: string, ...relations: string[]) => ({
  country,
  places: relations.map((relation, i) => ({ relation, id: `p${i}` })),
});

test("each relation word the photos use is counted once per photo, per country", () => {
  const uses = relationUses([
    photo("Japan", "near", "by"),
    photo("Japan", "near", "near"),
    photo("South Korea", "near", ","),
    photo("", "in"),
  ]);
  assert.deepEqual(uses, [
    { id: "relation-near-japan", word: "near", country: "Japan", photos: 2 },
    { id: "relation-by-japan", word: "by", country: "Japan", photos: 1 },
    { id: "relation-near-south-korea", word: "near", country: "South Korea", photos: 1 },
  ]);
});

test("a photo's custom country wins over its EXIF one", () => {
  const [use] = relationUses([{ ...photo("Japan", "at"), customCountry: "South Korea" }]);
  assert.equal(use?.id, "relation-at-south-korea");
});
