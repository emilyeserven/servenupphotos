import {
  type Localized,
  localizeName,
  mainName,
  localizePlace,
  mapLocalized,
  type Place,
  placeAncestry,
  placeById,
  SCRIPT_DISPLAYS,
  type ScriptDisplay,
} from "@portfolio/lib/localize";
import { gpsText, photoGps } from "@portfolio/lib/photo-gps";
import type { Photo, PhotoEntry } from "@portfolio/lib/photos";

/** Where the photo was taken, written each way the menu's Script Display can choose. */
export type LocalizedLocation = Record<ScriptDisplay, PhotoLocation>;

/** Where the photo was taken, as the portfolio shows it. */
export interface PhotoLocation {
  /** "Places, City", or else "City, Country", or else the country. */
  label: string;
  /** The lines shown on hover: the GPS position, then the country when the label leaves it out. */
  details: string[];
  /** Each part on its own, so a view can pick how much to show; each is null when there's none. */
  parts: PhotoLocationParts;
}

/** The parts of where a photo was taken, written one way. */
export interface PhotoLocationParts {
  /** The most specific of its places, such as "Geunjeongmun Gate". */
  specific: string | null;
  /** Its places as a phrase, such as "In Gyeongbokgung Palace by Geunjeongmun Gate". */
  places: string | null;
  city: string | null;
  /** The state, province or prefecture, between the city and the country. */
  state: string | null;
  country: string | null;
  /** The GPS position, such as 37°31′21″ N, 126°58′46″ E. */
  gps: string | null;
}

/** The photo's places, from PLACES.json, each with how the photo relates to it. */
export type PhotoPlaces = { relation: string; id: string }[];

/** The value written on the Photo page, or else the one from the EXIF; null when neither says. */
export function custom(written: string | null | undefined, exif: string | null): string | null {
  return written?.trim() || exif || null;
}

/** The non-empty parts, joined with commas. */
function joinParts(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(", ");
}

/**
 * One of the photo's places, with the word before it, such as "by Geunjeongmun Gate", or ", Queens"
 * for a comma.
 */
function placePart(word: string, name: Localized): Localized {
  return mapLocalized(name, (n, script) =>
    [word, n[script]].filter(Boolean).join(" ").replace(/^, /, ","),
  );
}

/** The parts after each other: a space between them, but none before a comma. */
function joinPlaceParts(parts: string[]): string {
  return parts.join(" ").replaceAll(" ,", ", ");
}

/** The word a place is joined to the place it's in with: its own, or else its parent's default, or else "in". */
function joinWord(place: Place): string {
  return place.parentRelation || placeById(place.parent)?.childRelation || "in";
}

/**
 * The word before the photo's place at `index`: when it's a place the place before it is in, the
 * word of the place just under it on the way up, as set on the Places page; else the photo's own.
 */
function wordBefore(places: PhotoPlaces, index: number): string {
  return placesWord(places, index) ?? places[index]?.relation ?? "";
}

/** The word from the Places page before the photo's place at `index`, if it's one the place before it is in. */
function placesWord(places: PhotoPlaces, index: number): string | undefined {
  const chain = chainBefore(places, index);
  const at = chain.findIndex((place) => place.id === places[index]?.id);
  return at > 0 ? chain.slice(at - 1, at).map(joinWord)[0] : undefined;
}

/** The photo's place before `index` and every place it's in; none for the first. */
function chainBefore(places: PhotoPlaces, index: number): Place[] {
  return index > 0 ? placeAncestry(places[index - 1]?.id) : [];
}

function capitalized(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The photo's places as a phrase, such as "In Gyeongbokgung Palace by Geunjeongmun Gate"; null
 * without any. Places missing from PLACES.json are left out. The old `placeName` isn't shown.
 */
function placeText(photo: PhotoEntry): Localized | null {
  const places = photo.places ?? [];
  const parts = places.flatMap(({ id }, index) => {
    const place = placeById(id);
    return place ? [placePart(wordBefore(places, index), localizePlace(place))] : [];
  });
  if (parts.length === 0) return null;
  return mapLocalized(parts, (p, script) =>
    capitalized(joinPlaceParts(p.map((part) => part[script]))),
  );
}

/** The most specific of the photo's places, the one inside the most others; null without any. */
function specificPlace(photo: PhotoEntry): Localized | null {
  const places = (photo.places ?? []).flatMap(({ id }) => placeAncestry(id).slice(0, 1));
  const deepest = places.toSorted(
    (a, b) => placeAncestry(b.id).length - placeAncestry(a.id).length,
  )[0];
  return deepest ? localizePlace(deepest) : null;
}

/** A city or country written each way, or null when there's none. */
function localizedField(type: "country" | "state" | "city", name: string | null): Localized | null {
  return name ? localizeName(type, name) : null;
}

/** The parts of where the photo was taken, each written every way. */
interface LocationParts {
  specific: Localized | null;
  place: Localized | null;
  city: Localized | null;
  state: Localized | null;
  country: Localized | null;
  gps: string | null;
}

/** Each part of where the photo was taken, written one way. */
function partsIn(parts: LocationParts, script: ScriptDisplay): PhotoLocationParts {
  const write = (part: Localized | null) => part?.[script] ?? null;
  return {
    specific: write(parts.specific),
    places: write(parts.place),
    city: write(parts.city),
    state: write(parts.state),
    country: write(parts.country),
    gps: parts.gps,
  };
}

/** Where the photo was taken, written one way: see photoLocation. */
function locationIn(parts: LocationParts, script: ScriptDisplay): PhotoLocation {
  const written = partsIn(parts, script);
  const { places, city, state, country } = written;
  const label = places ? joinParts(places, city) : joinParts(city, state, country);
  // The state and country go on hover only when the label leaves them out for the place.
  const details = [parts.gps, places ? state : null, places ? country : null];
  return { label, details: details.filter(Boolean) as string[], parts: written };
}

/**
 * Where the photo was taken, with a custom city and country over the EXIF ones: its places and
 * city, with the country on hover; or else its city and country; or else its country. Each is
 * written every Script Display way. Null without any of them, even when it has a GPS position.
 */
export function photoLocation(photo: PhotoEntry): LocalizedLocation | null {
  const parts: LocationParts = {
    specific: specificPlace(photo),
    place: placeText(photo),
    ...cityAndState(photo),
    country: localizedField("country", custom(photo.customCountry, photo.country)),
    gps: gpsText(photoGps(photo)),
  };
  if (!hasLocation(parts)) return null;
  return Object.fromEntries(
    SCRIPT_DISPLAYS.map((script) => [script, locationIn(parts, script)]),
  ) as LocalizedLocation;
}

/**
 * The state, or null when it has the city's name too, such as Seoul in Seoul, so the name isn't
 * written twice.
 */
export function distinctState(state: string | null, city: string | null): string | null {
  return state && state.trim().toLowerCase() === city?.trim().toLowerCase() ? null : state;
}

/** The photo's custom or EXIF city and state, each written every way, leaving out a state named like the city. */
function cityAndState(photo: PhotoEntry) {
  const city = custom(photo.customCity, photo.city);
  const state = distinctState(custom(photo.customState, photo.state ?? null), city);
  return { city: localizedField("city", city), state: localizedField("state", state) };
}

/** Whether the photo has any place, city, state or country to show; a GPS position alone isn't one. */
function hasLocation(parts: LocationParts): boolean {
  return Boolean(parts.place || parts.city || parts.state || parts.country);
}

/** The IDs of the photo's places and every place they're in, each once, its own places first. */
function placeIdsOf(photo: PhotoEntry): string[] {
  const ids = (photo.places ?? []).flatMap(({ id }) => placeAncestry(id).map((place) => place.id));
  return [...new Set(ids)];
}

/** The city or country the first of the places (or a place they're in) that says one is in. */
function placeField(placeIds: string[], field: "city" | "state" | "country"): string | null {
  return placeIds.map((id) => placeById(id)?.[field]?.trim()).find(Boolean) ?? null;
}

/** The name a country, state or city goes by, rather than one of its other names; null stays null. */
function mainNameOf(type: "country" | "state" | "city", name: string | null): string | null {
  return name && mainName(type, name);
}

/** Where the photo was taken, as the location filter matches it: see Photo. */
export function locationFields(photo: PhotoEntry) {
  const placeIds = placeIdsOf(photo);
  const field = (
    own: string | null | undefined,
    exif: string | null | undefined,
    key: "city" | "state" | "country",
  ) => mainNameOf(key, custom(own ?? null, exif ?? null) ?? placeField(placeIds, key));
  return {
    country: field(photo.customCountry, photo.country, "country"),
    state: field(photo.customState, photo.state, "state"),
    city: field(photo.customCity, photo.city, "city"),
    placeIds,
  };
}

/** The photos, each with a city but no country given the country other photos in that city have. */
export function withCityCountries(list: Photo[]): Photo[] {
  const countries = new Map(
    list.flatMap(({ city, country }) => (city && country ? [[city, country]] : [])),
  );
  return list.map((photo) =>
    photo.country || !photo.city ? photo : { ...photo, country: countries.get(photo.city) ?? null },
  );
}
