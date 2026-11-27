import assert from "node:assert/strict";
import { test } from "node:test";
import { BusyError, SlowError, StatusError } from "./overpass.js";
import {
  asksMap,
  failedLookup,
  lineIdOf,
  linesAnswer,
  onlineSource,
  parseSpot,
  spotsOf,
  stationsAnswer,
  trackAnswer,
} from "./transit-answers.js";
import { NoKindError, NoNameError, NoTrackError } from "./transit-types.js";
import { NoTransitlandKeyError } from "./transitland.js";

test("relays the rail and bus maps to Go and answers the rest here", () => {
  assert.ok(
    asksMap({ source: "mlit" }) && asksMap({ source: "osmrail" }) && asksMap({ source: "osmbus" }),
  );
  assert.ok(!asksMap({ source: "transitland" }) && !asksMap({}));
  assert.equal(onlineSource({ source: "transitland" }), "transitland");
  assert.equal(onlineSource({ source: "anything" }), "");
});

test("reads spots and line IDs as the Go backend did", () => {
  assert.deepEqual(parseSpot(" 135.5 , 34.69"), [135.5, 34.69]);
  assert.equal(parseSpot("181,0"), undefined);
  assert.equal(parseSpot("1"), undefined);
  assert.equal(parseSpot(",1"), undefined);
  assert.deepEqual(spotsOf({ from: "1,2" }), {
    status: 400,
    body: { message: "Give from and to as longitude,latitude." },
  });
  assert.equal(lineIdOf("+42"), 42);
  assert.equal((lineIdOf("0") as { status: number }).status, 400);
  assert.equal((lineIdOf("x") as { status: number }).status, 400);
});

test("answers each failure with the backend's status and message", () => {
  assert.equal(linesAnswer(undefined, new NoKindError()).status, 400);
  assert.equal(stationsAnswer(undefined, new NoNameError()).status, 400);
  assert.equal(trackAnswer(undefined, new NoTrackError()).status, 422);
  assert.equal(failedLookup("look up lines", new NoTransitlandKeyError()).status, 503);
  assert.deepEqual(
    failedLookup(
      "look up lines",
      new BusyError(4, 2, "overpass-api.de", new StatusError(504, "504 Gateway Timeout")),
    ),
    {
      status: 503,
      body: {
        message:
          "OpenStreetMap's line servers are busy right now, so we couldn't look up lines (tried 4 times on 2 servers; the last, overpass-api.de, answered 504 Gateway Timeout). Try again in a minute.",
      },
    },
  );
  assert.match(
    (failedLookup("x", new BusyError(1, 1, "s", new SlowError())).body as { message: string })
      .message,
    /took too long to answer/,
  );
  assert.deepEqual(trackAnswer([[1, 2]]), { status: 200, body: { path: [[1, 2]] } });
});
