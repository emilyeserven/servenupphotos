import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripLegRide } from "@/api/trips";
import { withChangeStation } from "@/lib/leg-rides";

const line = { id: 1, name: "San'in Line" };
const nagato = { label: "Nagato-shi", latitude: 34.37, longitude: 131.18 };
const rides: TripLegRide[] = [
  {
    change: nagato,
    line,
    path: [
      [130.92, 33.95],
      [131.18, 34.37],
    ],
  },
  {
    line,
    path: [
      [131.18, 34.37],
      [131.41, 34.42],
    ],
  },
];

test("renaming the change station keeps both rides' lines", () => {
  const next = withChangeStation(rides, 0, { ...nagato, label: "長門市" });
  assert.equal(next[0]!.change!.label, "長門市");
  assert.deepEqual(next[0]!.line, line);
  assert.deepEqual(next[1], rides[1]);
});

test("moving the change station drops the tracks on either side of it", () => {
  const masuda = { label: "Masuda", latitude: 34.675, longitude: 131.843 };
  assert.deepEqual(withChangeStation(rides, 0, masuda), [{ change: masuda }, {}]);
});
