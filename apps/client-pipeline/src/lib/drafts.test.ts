import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCasual,
  isDraft,
  isSetAside,
  isUnselected,
  leftOffPortfolio,
  titleOf,
} from "@/lib/drafts";

test("takes a title trimmed, and none when it's blank or not text", () => {
  assert.equal(titleOf({ title: "  Gate  " }), "Gate");
  assert.equal(titleOf({ title: "   " }), undefined);
  assert.equal(titleOf({ title: 5 }), undefined);
  assert.equal(titleOf(null), undefined);
  assert.equal(titleOf(undefined), undefined);
});

test("counts an untitled photo as a draft, but not a file that couldn't be read", () => {
  assert.equal(isDraft({}), true);
  assert.equal(isDraft({ title: " " }), true);
  assert.equal(isDraft({ title: "Gate" }), false);
  assert.equal(isDraft(undefined), false);
  assert.equal(isDraft(null), false);
});

test("counts an Undecided photo as a draft whatever its title", () => {
  assert.equal(isDraft({ title: "Gate", undecided: true }), true);
  assert.equal(isSetAside({ undecided: true }), true);
  assert.equal(isSetAside({ undecided: "true" }), false);
});

test("reads casual only when it's exactly true", () => {
  assert.equal(isCasual({ casual: true }), true);
  assert.equal(isCasual({ casual: 1 }), false);
  assert.equal(isCasual(undefined), false);
});

test("counts unselected only when it's an object", () => {
  assert.equal(isUnselected({ unselected: { group: "a" } }), true);
  assert.equal(isUnselected({ unselected: null }), false);
  assert.equal(isUnselected({ unselected: ["a"] }), false);
  assert.equal(isUnselected({ unselected: true }), false);
});

test("leaves a draft off the portfolio unless untitled photos are included", () => {
  assert.equal(leftOffPortfolio({}), true);
  assert.equal(leftOffPortfolio({}, true), false);
  assert.equal(leftOffPortfolio({ title: "Gate" }), false);
});

test("always leaves off a casual or unselected photo", () => {
  assert.equal(leftOffPortfolio({ title: "Lunch", casual: true }, true), true);
  assert.equal(leftOffPortfolio({ title: "Gate", unselected: {} }, true), true);
});

test("keeps an Undecided photo off only while drafts are kept", () => {
  assert.equal(leftOffPortfolio({ title: "Gate", undecided: true }), true);
  assert.equal(leftOffPortfolio({ title: "Gate", undecided: true }, true), false);
});
