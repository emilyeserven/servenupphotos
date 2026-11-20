import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadDetail, downloadShare, downloadTitle } from "@/lib/map-download";

const korea = "OpenStreetMap's bus map of South Korea";

test("a download says how much of its file it has", () => {
  const d = {
    map: korea,
    step: "downloading" as const,
    bytes: 120 * 1024 * 1024,
    total: 310 * 1024 * 1024,
    seconds: 45,
  };
  assert.equal(downloadTitle(d), `Downloading ${korea}`);
  assert.equal(downloadDetail(d), "120 of 310 MB · 0:45");
  assert.ok(Math.abs(downloadShare(d)! - 120 / 310) < 1e-9);
});

test("a download of no known size says how much it has so far, with no bar to fill", () => {
  const d = { map: korea, step: "downloading" as const, bytes: 512 * 1024, seconds: 65 };
  assert.equal(downloadDetail(d), "512 KB · 1:05");
  assert.equal(downloadShare(d), undefined);
});

test("reading a download says only how long it has taken", () => {
  const d = { map: korea, step: "reading" as const, bytes: 10, total: 10, seconds: 130 };
  assert.equal(downloadTitle(d), `Reading ${korea}`);
  assert.equal(downloadDetail(d), "2:10");
  assert.equal(downloadShare(d), undefined);
});
