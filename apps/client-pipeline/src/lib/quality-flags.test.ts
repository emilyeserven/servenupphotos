import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alreadyFlagged, flaggedNotes, flaggedReEdit } from "@/lib/quality-flags";

const flag = { reason: "Crop to 16:9", note: "Quality Check (aspect ratio): too tall." };

describe("flaggedReEdit", () => {
  it("marks an unmarked photo with the reason, dated today", () => {
    const reEdit = flaggedReEdit({}, flag);
    assert.equal(reEdit.reason, "Crop to 16:9");
    assert.match(reEdit.date, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps the reason and day a marked photo has, adding the new reason", () => {
    const data = { reEdit: { reason: "Too warm", date: "2026-10-01" } };
    assert.deepEqual(flaggedReEdit(data, flag), {
      reason: "Too warm; Crop to 16:9",
      date: "2026-10-01",
    });
  });

  it("doesn't repeat a reason the mark has already", () => {
    const data = { reEdit: { reason: "Crop to 16:9", date: "2026-10-01" } };
    assert.equal(flaggedReEdit(data, flag).reason, "Crop to 16:9");
  });
});

describe("flaggedNotes", () => {
  it("adds the note after a blank line, or on its own", () => {
    assert.equal(
      flaggedNotes({ notes: "Shot from the bridge." }, flag),
      `Shot from the bridge.\n\n${flag.note}`,
    );
    assert.equal(flaggedNotes({ notes: null }, flag), flag.note);
  });

  it("doesn't add a note the photo has already", () => {
    assert.equal(flaggedNotes({ notes: flag.note }, flag), flag.note);
  });
});

describe("alreadyFlagged", () => {
  it("is true only once the photo has both the reason and the note", () => {
    assert.equal(alreadyFlagged({}, flag), false);
    const marked = { reEdit: { reason: "Crop to 16:9", date: "2026-10-01" } };
    assert.equal(alreadyFlagged(marked, flag), false);
    assert.equal(alreadyFlagged({ ...marked, notes: flag.note }, flag), true);
  });
});
