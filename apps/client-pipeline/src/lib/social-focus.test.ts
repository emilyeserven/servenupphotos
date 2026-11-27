import assert from "node:assert/strict";
import { test } from "node:test";
import type { SocialPhoto } from "@/api/publish";
import { NO_FOCUS, isFocused, matchesFocus, parseList, takenDay } from "@/lib/social-focus";

/** A calendar photo with this JSON, eligible for social media unless said otherwise. */
function photo(data: Record<string, unknown>, isSocialMediaEligible = true): SocialPhoto {
  return { data, isSocialMediaEligible } as unknown as SocialPhoto;
}

const japan = photo({
  createDate: "2026:10:05 09:00:00",
  country: "Japan",
  customCity: "Kyoto",
  tags: ["Temple"],
  genres: ["street"],
});

test("a photo's day comes from its custom date, or else its EXIF date", () => {
  assert.equal(takenDay({ createDate: "2026:10:05 09:00:00" }), "2026-10-05");
  assert.equal(
    takenDay({ createDate: "2026:10:05", customCreateDate: "2026-11-01" }),
    "2026-11-01",
  );
  assert.equal(takenDay({}), "");
});

test("the Focus's dates keep photos taken from the first day to the last, either one left open", () => {
  assert.equal(
    matchesFocus(japan, { ...NO_FOCUS, takenFrom: "2026-10-01", takenTo: "2026-10-05" }),
    true,
  );
  assert.equal(matchesFocus(japan, { ...NO_FOCUS, takenFrom: "2026-10-06" }), false);
  assert.equal(matchesFocus(japan, { ...NO_FOCUS, takenTo: "2026-10-04" }), false);
  assert.equal(matchesFocus(japan, { ...NO_FOCUS, takenTo: "2026-10-05" }), true);
});

test("a photo without a date only passes a Focus without dates", () => {
  const undated = photo({});
  assert.equal(matchesFocus(undated, NO_FOCUS), true);
  assert.equal(matchesFocus(undated, { ...NO_FOCUS, takenFrom: "2026-01-01" }), false);
  assert.equal(matchesFocus(undated, { ...NO_FOCUS, takenTo: "2026-01-01" }), false);
});

test("the Focus's place, tags, genres and eligibility filter the photos", () => {
  assert.equal(matchesFocus(japan, { ...NO_FOCUS, place: " kyoto " }), true);
  assert.equal(matchesFocus(japan, { ...NO_FOCUS, place: "Seoul" }), false);
  assert.equal(matchesFocus(japan, { ...NO_FOCUS, tags: ["temple", "x"] }), true);
  assert.equal(matchesFocus(japan, { ...NO_FOCUS, genres: ["portrait"] }), false);
  assert.equal(matchesFocus(photo({}, false), { ...NO_FOCUS, eligibleOnly: true }), false);
});

test("a Focus field's words split on commas without their #, and an empty Focus filters nothing", () => {
  assert.deepEqual(parseList("#sunset, city , ,##night"), ["sunset", "city", "night"]);
  assert.equal(isFocused(NO_FOCUS), false);
  assert.equal(isFocused({ ...NO_FOCUS, place: "Japan" }), true);
});
