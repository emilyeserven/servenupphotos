import assert from "node:assert/strict";
import { test } from "node:test";
import type { MapDownload } from "@/api/transit";
import { downloadDetail, downloadShare, downloadTitle, stageState } from "@/lib/map-download";

const MB = 1024 * 1024;
const korea = "OpenStreetMap's bus map of South Korea";

/** A download of korea at step, with the rest filled in. */
function at(step: MapDownload["step"], rest: Partial<MapDownload> = {}): MapDownload {
  return { map: korea, step, detail: "", bytes: 0, seconds: 90, stepSeconds: 45, ...rest };
}

test("a download says how much it has, how fast, and how long is left", () => {
  const d = at("downloading", { bytes: 120 * MB, total: 310 * MB, rate: 2 * MB });
  assert.equal(downloadTitle(d), `Downloading ${korea}`);
  assert.equal(downloadDetail(d), "120 MB of 310 MB · 2.0 MB/s · about 2 min left");
  assert.ok(Math.abs(downloadShare(d)! - 120 / 310) < 1e-9);
});

test("a download of no known size says how much it has so far, with no bar to fill", () => {
  const d = at("downloading", { bytes: 512 * 1024 });
  assert.equal(downloadDetail(d), "512 KB");
  assert.equal(downloadShare(d), undefined);
});

test("reading the extract fills the bar with how much of it each pass has read", () => {
  const d = at("reading", { bytes: 100 * MB, total: 400 * MB, rate: 50 * MB });
  assert.equal(downloadTitle(d), `Reading ${korea}`);
  assert.equal(downloadDetail(d), "100 MB of 400 MB read · 50 MB/s · under a minute left");
  assert.equal(downloadShare(d), 0.25);
});

test("a step that moves no bytes says how long it has taken", () => {
  assert.equal(downloadDetail(at("connecting", { stepSeconds: 12 })), "0:12");
  assert.equal(downloadTitle(at("failed")), `Couldn't load ${korea}`);
});

test("the stages before the step are done", () => {
  assert.equal(stageState("connecting", "reading"), "done");
  assert.equal(stageState("reading", "reading"), "now");
  assert.equal(stageState("saving", "reading"), "next");
  assert.equal(stageState("connecting", "waiting"), "next");
});
