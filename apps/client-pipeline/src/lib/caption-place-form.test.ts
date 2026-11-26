import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type PlaceForm,
  fillTemplate,
  pickPlaceForm,
  withPlaceholder,
} from "@/lib/caption-place-form";
import { captionValues } from "@/lib/caption-template";

const lists = {
  places: [],
  localizations: [],
  names: { albums: new Map(), tags: new Map(), genres: new Map() },
};

/** The caption values of a photo with a place name and the city, state and country given. */
function photo(fields: Record<string, unknown>) {
  return captionValues(fields, lists);
}

const forms: PlaceForm[] = [
  { when: "0", text: "{city}[, {state}], {country}" },
  { when: "any", text: "{place1}, {city}, {state}" },
  { when: "any", text: "{place1}, {city}" },
];

test("a photo gets the first form for its number of places with every placeholder filled", () => {
  const withState = photo({
    placeName: "Gyeongbokgung",
    city: "Seoul",
    state: "Seoul",
    country: "Korea",
  });
  assert.equal(withState.placeCount, "1");
  assert.deepEqual(pickPlaceForm(forms, withState), {
    index: 1,
    text: "Gyeongbokgung, Seoul, Seoul",
  });
  const noState = photo({ placeName: "Gyeongbokgung", city: "Seoul" });
  assert.deepEqual(pickPlaceForm(forms, noState), { index: 2, text: "Gyeongbokgung, Seoul" });
  const noPlace = photo({ city: "Seoul", country: "Korea" });
  assert.equal(noPlace.placeCount, "0");
  assert.deepEqual(pickPlaceForm(forms, noPlace), { index: 0, text: "Seoul, Korea" });
  assert.equal(pickPlaceForm([{ when: "2", text: "{place1}" }], withState), null);
  assert.equal(pickPlaceForm([{ when: "3+", text: "{place1}" }], withState), null);
});

test("{from_places_form} fills in the template, and is empty when no form fits", () => {
  const values = photo({ title: "Gate", placeName: "Gyeongbokgung", city: "Seoul" });
  const template = { template: "{title}\n{from_places_form}", places: forms };
  assert.equal(fillTemplate(template, values), "Gate\nGyeongbokgung, Seoul");
  assert.equal(fillTemplate({ template: template.template }, values), "Gate");
});

test("a placeholder clicked goes in the form at the cursor, the last form, or a new one", () => {
  const two: PlaceForm[] = [
    { when: "any", text: "{city}" },
    { when: "1", text: "AB" },
  ];
  assert.equal(withPlaceholder(two, { index: 1, start: 1, end: 2 }, "{x}")[1]!.text, "A{x}");
  assert.equal(withPlaceholder(two, { index: 0 }, "{x}")[0]!.text, "{city}{x}");
  assert.equal(withPlaceholder(two, { index: null }, "{x}")[1]!.text, "AB{x}");
  assert.deepEqual(withPlaceholder([], { index: null }, "{x}"), [{ when: "any", text: "{x}" }]);
});
