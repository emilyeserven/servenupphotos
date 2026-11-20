import assert from "node:assert/strict";
import { test } from "node:test";
import { isoDate, parseIsoDate, shortDate, weekdayDate } from "@portfolio/lib/dates";

test("writes a day with zero-padded parts and reads it back at local midnight", () => {
  assert.equal(isoDate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(parseIsoDate("2026-01-05").getTime(), new Date(2026, 0, 5).getTime());
});

test("writes a day the short way and with its weekday", () => {
  assert.equal(shortDate("2026-11-03"), "Nov 3, 2026");
  assert.equal(shortDate(new Date(2026, 10, 3, 23, 30)), "Nov 3, 2026");
  assert.equal(weekdayDate("2026-11-03"), "Tue, Nov 3, 2026");
});
