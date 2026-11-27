import assert from "node:assert/strict";
import { test } from "node:test";
import type { SocialPhoto } from "@/api/publish";
import { postedPhotoFiles } from "@/lib/social-post-days";

/** A calendar photo at path with this JSON, in ALLPHOTOS.json on the base branch unless said otherwise. */
function photo(path: string, data: Record<string, unknown>, inAllPhotos = true): SocialPhoto {
  return { path, data, inAllPhotos } as unknown as SocialPhoto;
}

test("each photo is named by its title, else its file name without the extension, else its JSON file", () => {
  const files = postedPhotoFiles(
    [
      photo("photos/a.json", { title: " Gate ", file: "DSCF1.jpg" }),
      photo("photos/b.json", { file: "DSCF2.jpg" }),
      photo("photos/c.json", {}),
    ],
    new Map(),
  );
  assert.deepEqual(
    files.map((f) => f.name),
    ["Gate", "DSCF2", "c.json"],
  );
});

test("each photo shows its Square Thumbnail, else its smallest version, else none", () => {
  const files = postedPhotoFiles(
    [
      photo("a.json", { images: { small: "s.webp", thumbnail: "t.webp" } }),
      photo("b.json", { images: { thumbnail: "", medium: "m.webp", large: "l.webp" } }),
      photo("c.json", { images: "none" }),
    ],
    new Map(),
  );
  assert.deepEqual(
    files.map((f) => f.image),
    ["t.webp", "m.webp", null],
  );
});

test("changes waiting for Commit are made over the files read, and add or remove files", () => {
  const changed = new Map<string, unknown>([
    ["b.json", { title: "Changed" }],
    ["c.json", null],
    ["new.json", { title: "Added" }],
    ["gone.json", null],
  ]);
  const files = postedPhotoFiles(
    [
      photo("a.json", { title: "A" }),
      photo("b.json", {}),
      photo("c.json", {}),
      photo("d.json", {}, false),
    ],
    changed,
  );
  assert.deepEqual(
    files.map((f) => [f.path, f.name, f.inFlight]),
    [
      ["a.json", "A", false],
      ["b.json", "Changed", true],
      ["d.json", "d.json", true],
      ["new.json", "Added", true],
    ],
  );
});
