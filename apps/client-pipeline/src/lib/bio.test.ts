import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_BIO,
  addPortrait,
  addSitePhoto,
  bioPhotoKey,
  bioPhotoName,
  bioTileImage,
  moveBioPhoto,
  removeBioPhoto,
  setPortraitAlt,
} from "@/lib/bio";

const portrait = {
  image: "https://cdn/me.webp",
  small: "https://cdn/me-small.webp",
  width: 2,
  height: 3,
  alt: "",
};

test("photos are added at the end, and a portfolio photo only once", () => {
  let bio = addSitePhoto(EMPTY_BIO, "a.json");
  bio = addPortrait(bio, portrait);
  bio = addSitePhoto(bio, "a.json");
  assert.deepEqual(bio.photos.map(bioPhotoKey), ["a.json", "https://cdn/me.webp"]);
});

test("photos move and come off by their place", () => {
  let bio = addSitePhoto(addSitePhoto(addPortrait(EMPTY_BIO, portrait), "a.json"), "b.json");
  bio = moveBioPhoto(bio, 2, 0);
  assert.deepEqual(bio.photos.map(bioPhotoKey), ["b.json", "https://cdn/me.webp", "a.json"]);
  assert.deepEqual(removeBioPhoto(bio, 1).photos.map(bioPhotoKey), ["b.json", "a.json"]);
});

test("alt text is set only on a self-portrait", () => {
  const bio = addSitePhoto(addPortrait(EMPTY_BIO, portrait), "a.json");
  const next = setPortraitAlt(setPortraitAlt(bio, 0, "Me"), 1, "ignored");
  assert.equal(next.photos[0]?.portrait?.alt, "Me");
  assert.deepEqual(next.photos[1], { photo: "a.json" });
});

test("a photo is named by its alt text, its title, or its file", () => {
  assert.equal(bioPhotoName({ portrait }, undefined), "Self-portrait");
  assert.equal(bioPhotoName({ portrait: { ...portrait, alt: "Me" } }, undefined), "Me");
  assert.equal(bioPhotoName({ photo: "data/photos/A.json" }, "Seoul"), "Seoul");
  assert.equal(bioPhotoName({ photo: "data/photos/A.json" }, undefined), "A.json");
});

test("a tile shows a self-portrait's small version, or the photo's thumbnail", () => {
  assert.equal(bioTileImage({ portrait }, "x"), "https://cdn/me-small.webp");
  assert.equal(bioTileImage({ photo: "a.json" }, "thumb.webp"), "thumb.webp");
  assert.equal(bioTileImage({ photo: "a.json" }, null), undefined);
});
