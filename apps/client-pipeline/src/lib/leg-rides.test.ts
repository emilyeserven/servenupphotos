import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripTransitLine } from "@/api/trip-lines";
import type { TripLeg, TripLegRide } from "@/api/trips";
import { separateRides, withChangeStation, withRides } from "@/lib/leg-rides";

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

const ends = { mode: "train", from: {}, to: {} } as unknown as TripLeg;
const blue = { id: "blue", name: "Blue" } as unknown as TripTransitLine;
const red = { id: "red", name: "Red" } as unknown as TripTransitLine;
const onBlue = {
  line: blue,
  path: [
    [0, 0],
    [1, 1],
  ],
} as TripLegRide;
const onRed = {
  change: { latitude: 1, longitude: 1 },
  line: red,
  path: [
    [1, 1],
    [2, 2],
  ],
} as TripLegRide;

test("a leg with one ride rides its line, or none when the ride has no line", () => {
  const leg = { ...ends, line: red, path: [[9, 9]] } as TripLeg;
  assert.deepEqual(withRides(leg, [onBlue]), { ...ends, line: blue, path: onBlue.path });
  assert.deepEqual(withRides(leg, [{}]), ends);
  assert.deepEqual(withRides(leg, []), ends);
});

test("a leg's rides stay separate lines unless they were combined, which combines them again", () => {
  assert.deepEqual(withRides(ends, [onBlue, onRed]), { ...ends, rides: [onBlue, onRed] });
  const combined = {
    ...ends,
    rides: [onBlue, onRed],
    line: { ...blue, name: "Airport route" },
  } as TripLeg;
  assert.deepEqual(withRides(combined, [onBlue, onRed]), {
    ...ends,
    rides: [onBlue, onRed],
    line: { ...blue, name: "Airport route" },
    path: [
      [0, 0],
      [1, 1],
      [1, 1],
      [2, 2],
    ],
  });
});

test("separate rides are drawn only when none is combined and each has a line and a track", () => {
  assert.deepEqual(separateRides({ ...ends, rides: [onBlue, onRed] }), [onBlue, onRed]);
  assert.equal(separateRides({ ...ends, rides: [onBlue, onRed], line: blue }), undefined);
  assert.equal(
    separateRides({ ...ends, rides: [onBlue, { ...onRed, path: [[1, 1]] }] }),
    undefined,
  );
  assert.equal(separateRides({ ...ends, rides: [onBlue, { change: onRed.change }] }), undefined);
  assert.equal(separateRides(ends), undefined);
});
