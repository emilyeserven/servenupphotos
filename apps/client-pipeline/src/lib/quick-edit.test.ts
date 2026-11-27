import assert from "node:assert/strict";
import { test } from "node:test";
import { placeKeyForEdit, quickEditTarget } from "@/lib/quick-edit";
import type { RegionNode } from "@/lib/region-tree";

/** The pipeline address Quick Edit opens for a link, or its error. */
function hrefOf(text: string): string {
  const target = quickEditTarget(text);
  return "href" in target ? target.href : `error: ${target.error}`;
}

test("a photo's own page and a view with a photo open open the photo editor", () => {
  assert.equal(hrefOf("https://servenupphotos.net/photos/512/"), "/exif?photo=512");
  assert.equal(
    hrefOf("https://servenupphotos.net/photos/512/?from=%2Ftimeline"),
    "/exif?photo=512",
  );
  assert.equal(hrefOf("servenupphotos.net/grid?photo=77&size=large"), "/exif?photo=77");
  assert.equal(hrefOf("https://servenupphotos.net/albums/japan?photo=9"), "/exif?photo=9");
});

test("albums, Trips and a day's page open their pipeline pages", () => {
  assert.equal(hrefOf("https://servenupphotos.net/albums/japan-2026"), "/albums/japan-2026");
  assert.equal(hrefOf("https://servenupphotos.net/albums/trips/korea"), "/trip-lines/trips/korea");
  assert.equal(
    hrefOf("https://servenupphotos.net/albums/trips/day-2026-10-01/"),
    "/trip-lines/2026-10-01",
  );
});

test("a view filtered on an album, tag or genre opens that one, with JSON-quoted values read", () => {
  assert.equal(hrefOf("https://servenupphotos.net/grid?tag=sunset"), "/tags/sunset");
  assert.equal(hrefOf("https://servenupphotos.net/map?genre=%22street%22"), "/genres/street");
  assert.equal(hrefOf("https://servenupphotos.net/timeline?album=%22123%22"), "/albums/123");
  assert.equal(hrefOf("https://servenupphotos.net/tags?tag=cats"), "/tags/cats");
});

/** The Places page's address with the row Quick Edit opens. */
function places(edit: string): string {
  return `/places?edit=${encodeURIComponent(JSON.stringify(edit))}`;
}

test("map place pages and location filters open the Places page on that place", () => {
  assert.equal(hrefOf("https://servenupphotos.net/maps/city/seoul/"), places("city/seoul"));
  assert.equal(
    hrefOf("https://servenupphotos.net/maps/place/gyeongbokgung/"),
    places("place/gyeongbokgung"),
  );
  assert.equal(hrefOf("https://servenupphotos.net/grid?city=New%20York"), places("city/new-york"));
  assert.equal(hrefOf("https://servenupphotos.net/maps/all/"), "/places");
});

test("a page about one thing opens its pipeline page", () => {
  assert.equal(hrefOf("https://servenupphotos.net/"), "/site-spotlight");
  assert.equal(hrefOf("https://servenupphotos.net/tags?sort=count"), "/tags");
  assert.equal(hrefOf("/bio"), "/bio");
  assert.equal(hrefOf("http://localhost:5173/albums"), "/albums");
});

test("a view of many photos, another site, or text says why it can't open", () => {
  assert.match(hrefOf("https://servenupphotos.net/grid?size=large"), /doesn't show one thing/);
  assert.match(hrefOf("https://example.com/photos/1"), /example\.com, not the portfolio/);
  assert.match(hrefOf("   "), /isn't a link/);
});

test("a Quick Edit place edit picks the Places row: a place by its ID, a city by its name's slug", () => {
  const nodes = [
    { key: "city:new-york", kind: "city", name: "New York", parentKey: "", photos: 3 },
    {
      key: "place:p1",
      kind: "place",
      name: "Central Park",
      parentKey: "city:new-york",
      photos: 1,
      place: { id: "p1", name: "Central Park" },
    },
  ] as RegionNode[];
  assert.equal(placeKeyForEdit(nodes, "city/new-york"), "city:new-york");
  assert.equal(placeKeyForEdit(nodes, "place/p1"), "place:p1");
  // A place is never matched by its name's slug, and a kind must match too.
  assert.equal(placeKeyForEdit(nodes, "place/central-park"), "");
  assert.equal(placeKeyForEdit(nodes, "country/new-york"), "");
});

test("a Quick Edit place edit without a kind and a name matches no row", () => {
  const nodes = [
    { key: "city:seoul", kind: "city", name: "Seoul", parentKey: "", photos: 1 },
  ] as RegionNode[];
  assert.equal(placeKeyForEdit(nodes, undefined), "");
  assert.equal(placeKeyForEdit(nodes, ""), "");
  assert.equal(placeKeyForEdit(nodes, "city"), "");
  assert.equal(placeKeyForEdit(nodes, "city/"), "");
});
