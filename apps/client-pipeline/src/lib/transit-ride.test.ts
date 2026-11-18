import assert from "node:assert/strict";
import { test } from "node:test";
import { ridesOf } from "@/lib/transit-ride";

test("keeps each line of a route that changed lines, with the station it changed at", () => {
  const rides = ridesOf({
    path: [],
    rides: [
      {
        line: { id: 31, name: "北松江線", kind: "train", source: "mlit" },
        path: [
          [0, 0],
          [1, 1],
        ],
        change: { name: "川跡", latitude: 1, longitude: 1 },
      },
      {
        line: { id: 30, name: "大社線", kind: "train", source: "mlit" },
        path: [
          [1, 1],
          [2, 1],
        ],
      },
    ],
  });
  assert.deepEqual(rides, [
    {
      line: { id: 31, name: "北松江線", source: "mlit" },
      path: [
        [0, 0],
        [1, 1],
      ],
      change: { latitude: 1, longitude: 1, label: "川跡" },
    },
    {
      line: { id: 30, name: "大社線", source: "mlit" },
      path: [
        [1, 1],
        [2, 1],
      ],
    },
  ]);
});

test("keeps none for a route of one line", () => {
  assert.equal(
    ridesOf({
      path: [
        [0, 0],
        [1, 1],
      ],
    }),
    undefined,
  );
});
