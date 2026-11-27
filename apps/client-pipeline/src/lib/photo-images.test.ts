import assert from "node:assert/strict";
import { test } from "node:test";
import type { SanitizedExif } from "@/api/exif";
import type { UploadResponse } from "@/api/upload";
import { thumbnailCropField } from "@/api/versions";
import { withImages } from "@/lib/photo-images";

const NAMES = [
  "xlarge",
  "large",
  "medium",
  "small",
  "xsmall",
  "preview",
  "thumbnail",
  "thumbnailpreview",
];

/** An upload of a.jpg, each version at `<name>.webp`, with the Square Thumbnail's crop when given. */
function upload(thumbnailCrop?: UploadResponse["thumbnailCrop"]): UploadResponse {
  const versions = Object.fromEntries(
    NAMES.map((name) => [name, { key: name, url: `${name}.webp` }]),
  );
  return {
    key: "a.jpg",
    url: "a.jpg",
    versions,
    ...(thumbnailCrop && { thumbnailCrop }),
  } as UploadResponse;
}

const sanitized = { title: "Gate", images: { alt: "kept" } } as unknown as SanitizedExif;

test("an uploaded photo's EXIF gets its R2 URLs, key and Square Thumbnail crop", () => {
  const crop = { x: 10, y: 20, size: 300 };
  const images = withImages(sanitized, upload(crop))?.images as Record<string, unknown>;
  assert.equal(images.alt, "kept");
  assert.equal(images.full, "a.jpg");
  assert.equal(images.key, "a.jpg");
  for (const name of NAMES) assert.equal(images[name], `${name}.webp`);
  assert.deepEqual(images.thumbnailcrop, thumbnailCropField(crop));
  const uncropped = withImages(sanitized, upload())?.images as Record<string, unknown> | undefined;
  assert.equal(uncropped?.thumbnailcrop, null);
});

test("before the upload, or without EXIF, the EXIF stays as it is", () => {
  assert.equal(withImages(sanitized, undefined), sanitized);
  assert.equal(withImages(null, upload()), null);
  assert.equal(withImages(undefined, undefined), null);
});
