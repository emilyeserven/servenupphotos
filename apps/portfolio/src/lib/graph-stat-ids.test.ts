import assert from "node:assert/strict";
import { test } from "node:test";
import type { GraphStat } from "@portfolio/lib/graph-data";
import { uniqueStats } from "@portfolio/lib/graph-stat-ids";

/** A stat with no rows, for the IDs. */
function stat(id: string, label: string, section: string): GraphStat {
  return { id, label, section, build: () => ({ title: label, rows: [] }) as never };
}

test("a Numbers group with a camera setting's ID is renamed, the setting keeps it", () => {
  const stats = uniqueStats(
    [stat("aperture", "Aperture", "Gear"), stat("shutter-speed", "Shutter speed", "Gear")],
    [stat("aperture", "Aperture", "Technical")],
  );
  assert.deepEqual(
    stats.map((s) => [s.id, s.label]),
    [
      ["aperture-ranges", "Aperture ranges"],
      ["shutter-speed", "Shutter speed"],
      ["aperture", "Aperture"],
    ],
  );
});
