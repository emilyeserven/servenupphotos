import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExifResponse } from "@/api/exif";
import { UploadError, type UploadResponse } from "@/api/upload";
import { type BulkPhoto, canRetry, failure, renamed } from "@/lib/bulk-upload";

const photo = (extra: Partial<BulkPhoto> = {}): BulkPhoto => ({
  id: "bulk-1",
  file: new File(["jpeg"], "IMG_0001.jpg", { type: "image/jpeg" }),
  step: "failed",
  ...extra,
});

const titled = { sanitized: { title: "Sunset" } } as unknown as ExifResponse;

describe("failure", () => {
  it("keeps the free name the backend offered", () => {
    const error = new UploadError("taken", [], undefined, "img-0001-2");
    assert.equal(failure(error).suggestedName, "img-0001-2");
  });

  it("offers no name for other failures", () => {
    assert.equal(failure(new Error("offline")).suggestedName, undefined);
  });
});

describe("renamed", () => {
  it("renames the file before it's uploaded, and its JSON when it has no title", () => {
    const change = renamed(photo(), "img-0001-2");
    assert.equal(change.file?.name, "img-0001-2.jpg");
    assert.equal(change.file?.type, "image/jpeg");
    assert.equal(change.jsonName, "img-0001-2");
  });

  it("leaves a titled photo's JSON named after its title", () => {
    const change = renamed(photo({ exif: titled }), "img-0001-2");
    assert.equal(change.file?.name, "img-0001-2.jpg");
    assert.equal(change.jsonName, undefined);
  });

  it("renames only the JSON once the photo is in R2", () => {
    const upload = { key: "photos/a.jpg" } as UploadResponse;
    assert.deepEqual(renamed(photo({ upload }), "sunset-2"), { jsonName: "sunset-2" });
  });
});

describe("canRetry", () => {
  it("offers Retry for a plain failure", () => {
    assert.equal(canRetry(photo({ retryable: true })), true);
  });

  it("offers it as Keep name when R2 has the name", () => {
    const sameName = [{ key: "photos/a-img-0001.jpg" }] as BulkPhoto["sameName"];
    assert.equal(canRetry(photo({ retryable: true, sameName, suggestedName: "img-0001-2" })), true);
  });

  it("leaves it out when only renaming the JSON helps", () => {
    assert.equal(canRetry(photo({ retryable: true, suggestedName: "sunset-2" })), false);
  });

  it("leaves it out for a photo that isn't a JPEG", () => {
    assert.equal(canRetry(photo({ retryable: false })), false);
  });
});
