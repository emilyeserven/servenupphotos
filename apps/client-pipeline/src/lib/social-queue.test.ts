import assert from "node:assert/strict";
import { test } from "node:test";
import type { DayPost } from "@/lib/social-post-days";
import { scheduledDaysFrom } from "@/lib/social-queue";

/** An Instagram post on a day with the given status. */
function post(status: DayPost["status"]): DayPost {
  return {
    photo: { path: "p.json", data: {}, name: "p", image: null, inFlight: false },
    status,
    url: "",
  };
}

test("counts days in a row from today with a scheduled post", () => {
  const posts = new Map([
    ["2026-11-10", [post("scheduled")]],
    ["2026-11-11", [post("planned"), post("scheduled")]],
    ["2026-11-12", [post("scheduled")]],
    ["2026-11-14", [post("scheduled")]],
  ]);
  assert.equal(scheduledDaysFrom(posts, "2026-11-10"), 3);
});

test("a day with only planned posts ends the run", () => {
  const posts = new Map([
    ["2026-11-10", [post("scheduled")]],
    ["2026-11-11", [post("planned")]],
    ["2026-11-12", [post("scheduled")]],
  ]);
  assert.equal(scheduledDaysFrom(posts, "2026-11-10"), 1);
});

test("is 0 when today has nothing scheduled", () => {
  const posts = new Map([["2026-11-10", [post("planned")]]]);
  assert.equal(scheduledDaysFrom(posts, "2026-11-10"), 0);
  assert.equal(scheduledDaysFrom(new Map(), "2026-11-10"), 0);
});

test("a Not Stored post counts as a scheduled day", () => {
  const posts = new Map([
    ["2026-11-10", [post("scheduled")]],
    ["2026-11-12", [post("scheduled")]],
  ]);
  assert.equal(scheduledDaysFrom(posts, "2026-11-10", ["2026-11-11"]), 3);
});
