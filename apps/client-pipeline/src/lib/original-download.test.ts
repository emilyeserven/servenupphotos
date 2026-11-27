import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { originalHref } from "@/lib/original-download";

describe("originalHref", () => {
  it("downloads the R2 key, named after the photo's file", () => {
    const data = { file: "DSCF4800.jpg", images: { key: "photos/abc-dscf4800.jpg" } };
    assert.equal(
      originalHref(data),
      "/api/photos/original?key=photos%2Fabc-dscf4800.jpg&name=DSCF4800.jpg",
    );
  });

  it("keeps the key's own name without a file", () => {
    assert.equal(
      originalHref({ images: { key: "photos/abc.jpg" } }),
      "/api/photos/original?key=photos%2Fabc.jpg",
    );
  });

  it("has nothing to download without a key", () => {
    assert.equal(originalHref({ file: "a.jpg", images: {} }), undefined);
    assert.equal(originalHref({}), undefined);
  });
});
