import assert from "node:assert/strict";
import { test } from "node:test";
import { savedSocialPosts } from "@/lib/social-posts";

/** The statuses of the posts saved in socialPosts, worked out on 2026-11-27. */
function statuses(socialPosts: unknown): string[] {
  return savedSocialPosts({ socialPosts }, "2026-11-27").map((post) => post.status);
}

test("a post keeps the status it was saved with", () => {
  assert.deepEqual(statuses([{ status: "planned", url: "https://x" }, { status: "scheduled" }]), [
    "planned",
    "scheduled",
  ]);
});

test("a post saved without a status is scheduled once it has a link or its day has come", () => {
  assert.deepEqual(
    statuses([
      { status: "posted" },
      { url: "https://instagram.com/p/1" },
      { date: "2026-11-27" },
      { date: "2026-11-28" },
      { url: " " },
    ]),
    ["scheduled", "scheduled", "scheduled", "planned", "planned"],
  );
});

test("a saved post becomes a draft with its hashtags written out, and no list has no posts", () => {
  const [draft] = savedSocialPosts({
    socialPosts: [{ hashtags: ["tokyo", "", 3], caption: "Hi" }],
  });
  assert.equal(draft?.platform, "other");
  assert.equal(draft?.hashtags, "#tokyo");
  assert.equal(draft?.caption, "Hi");
  assert.deepEqual(savedSocialPosts({ socialPosts: "none" }), []);
  assert.deepEqual(statuses(["not a post"]), []);
});
