import assert from "node:assert/strict";
import { test } from "node:test";
import { fillTemplate } from "@/lib/caption-place-form";
import { captionValues } from "@/lib/caption-template";
import {
  captionLineParts,
  locationParts,
  toggledHidden,
  withHiddenParts,
  withoutHiddenLines,
} from "@/lib/photo-book-hidden";

const lists = {
  places: [
    { id: "palace", name: "Gyeongbokgung" },
    { id: "gate", name: "Gwanghwamun" },
  ] as never[],
  localizations: [],
  names: { albums: new Map(), tags: new Map(), genres: new Map() },
};

const photo = {
  places: [
    { relation: "", id: "palace" },
    { relation: "near", id: "gate" },
  ],
  city: "Seoul",
  customState: "Seoul Special City",
  country: "South Korea",
};

test("a photo's location parts are its places, then its city, state and country", () => {
  assert.deepEqual(
    locationParts(photo, lists).map((p) => `${p.key}=${p.name}`),
    [
      "place:palace=Gyeongbokgung",
      "place:gate=Gwanghwamun",
      "city=Seoul",
      "state=Seoul Special City",
      "country=South Korea",
    ],
  );
  assert.deepEqual(
    locationParts({ placeName: "Market" }, lists).map((p) => p.key),
    ["placeName"],
  );
});

test("hidden parts fill the caption in as if the photo didn't have them", () => {
  const template = {
    template: "{from_places_form}",
    places: [{ text: "{place1}[, {relation2} {place2}][, {state}], {country}" }],
  };
  const fill = (hidden?: string[]) =>
    fillTemplate(template, captionValues(withHiddenParts(photo, hidden), lists));
  assert.equal(fill(), "Gyeongbokgung, near Gwanghwamun, Seoul Special City, South Korea");
  assert.equal(fill(["place:gate", "state"]), "Gyeongbokgung, South Korea");
  assert.equal(fill(["place:palace"]), "Gwanghwamun, Seoul Special City, South Korea");
  assert.deepEqual(toggledHidden(["city"], "state"), ["city", "state"]);
  assert.deepEqual(toggledHidden(["city", "state"], "city"), ["state"]);
});

test("a caption's lines are listed by their text, without blank ones", () => {
  assert.deepEqual(captionLineParts("Night market\n<i>2026.05.19</i>\n\nX-T5"), [
    { key: "line:0", name: "Night market", kind: "Line" },
    { key: "line:1", name: "2026.05.19", kind: "Line" },
    { key: "line:3", name: "X-T5", kind: "Line" },
  ]);
});

test("a hidden line is left out of the caption", () => {
  assert.equal(withoutHiddenLines("a\nb\nc", ["line:1", "city"]), "a\nc");
  assert.equal(withoutHiddenLines("a\nb", ["city"]), "a\nb");
  assert.equal(withoutHiddenLines("a\nb", undefined), "a\nb");
});
