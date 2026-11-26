import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type PlaceForm,
  fillTemplate,
  pickPlaceForm,
  conditionState,
  formConditions,
  replacePlaces,
  filledLines,
  withCondition,
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
  assert.deepEqual(withPlaceholder([], { index: null }, "{x}"), [{ text: "{x}" }]);
});

test("exceptions write text in the place name another way", () => {
  const values = photo({ city: "New York", country: "United States of America" });
  const replacements = [
    { from: "United States of America", to: "USA" },
    { from: "", to: "x" },
  ];
  assert.deepEqual(
    pickPlaceForm([{ when: "any", text: "{city}, {country}" }], values, replacements),
    {
      index: 0,
      text: "New York, USA",
    },
  );
  assert.equal(replacePlaces("A, B", [{ from: ", B", to: "" }]), "A");
});

test("a form's condition names the fields the photo has to have, or not have, a value for", () => {
  const cityOnly = photo({ city: "Seoul", country: "Korea" });
  const withState = photo({ city: "Austin", state: "Texas", country: "USA" });
  const conditioned: PlaceForm[] = [
    { has: ["city", "state"], text: "{city}, {state}" },
    { has: ["city"], lacks: ["state"], text: "{city} ({country})" },
  ];
  assert.equal(pickPlaceForm(conditioned, withState)?.text, "Austin, Texas");
  assert.equal(pickPlaceForm(conditioned, cityOnly)?.text, "Seoul (Korea)");
  assert.equal(pickPlaceForm(conditioned, photo({ country: "Korea" })), null);
});

test("an older place count reads as conditions on the numbered places", () => {
  assert.deepEqual(formConditions({ when: "1", text: "x" }), {
    has: ["place1"],
    lacks: ["place2"],
    text: "x",
  });
  assert.deepEqual(formConditions({ when: "any", text: "x" }), { text: "x" });
  const form = withCondition({ when: "2", text: "x" }, "city", "has");
  assert.deepEqual(form, { has: ["place2", "city"], lacks: ["place3"], text: "x" });
  assert.equal(conditionState(form, "place3"), "lacks");
  assert.deepEqual(withCondition(form, "place3", "off"), { has: ["place2", "city"], text: "x" });
});

test("a form's lines go one under another, each left out when it can't fill in or repeats one above", () => {
  const form: PlaceForm = {
    text: "{cityLocal|city}, {country}",
    more: ["{cityRomanized}, {country}", "{city}, {country}", "{state}"],
  };
  const seoul = {
    city: "Seoul",
    cityLocal: "서울특별시",
    cityRomanized: "Seoul",
    country: "Korea",
  };
  assert.equal(pickPlaceForm([form], seoul)?.text, "서울특별시, Korea\nSeoul, Korea");
  assert.deepEqual(filledLines(form, seoul), ["서울특별시, Korea", "Seoul, Korea", null, null]);
  const plain = { city: "New York", country: "USA" };
  assert.equal(pickPlaceForm([form], plain)?.text, "New York, USA");
  const at = withPlaceholder([form], { index: 0, line: 2, start: 0 }, "{x}");
  assert.equal(at[0]!.more?.[1], "{x}{city}, {country}");
});
