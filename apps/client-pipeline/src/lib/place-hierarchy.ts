import type { Localization, PhotoPlace, Place } from "@/api/places";
import { localizationId } from "@/api/places";

/** The place with the ID, if there is one. */
function byId(places: Place[], id: string | undefined): Place | undefined {
  return places.find((place) => place.id === id);
}

/** The place place is directly in, unless it's one already found, as in a loop. */
function nextUp(places: Place[], place: Place | undefined, found: Place[]): Place | undefined {
  const parent = byId(places, place?.parent);
  return parent && !found.includes(parent) ? parent : undefined;
}

/** The places id is in, nearest first, such as the palace a gate is in; stops at a loop. */
function ancestors(places: Place[], id: string): Place[] {
  const found: Place[] = [];
  for (let up = nextUp(places, byId(places, id), found); up; up = nextUp(places, up, found)) {
    found.push(up);
  }
  return found;
}

/** Whether the place `above` is one the place `id` is in. */
function isAbove(places: Place[], above: string, id: string): boolean {
  return ancestors(places, id).some((place) => place.id === above);
}

/** The IDs of the places in place `id`, at any depth, and its own, none of which can be its parent. */
export function notParentsOf(places: Place[], id: string): Set<string> {
  return new Set([id, ...places.filter((p) => isAbove(places, id, p.id)).map((p) => p.id)]);
}

/** The rows with places chosen. */
function chosen(rows: PhotoPlace[]): PhotoPlace[] {
  return rows.filter((row) => row.id);
}

/** The parent of the place in row `index`, when it's the only place chosen and has a known parent. */
function parentToAdd(rows: PhotoPlace[], index: number, places: Place[]): string | undefined {
  if (chosen(rows).length !== 1) return undefined;
  return nextUp(places, byId(places, rows[index]?.id), [])?.id;
}

/** rows with the place `id` in the row other than `index`, "in" unless that row has a relation. */
function withOther(rows: PhotoPlace[], index: number, id: string): PhotoPlace[] {
  const other = rows.findIndex((_, i) => i !== index);
  if (other === -1) return [...rows, { relation: "in", id }];
  const row = rows[other];
  return rows.with(other, { relation: row?.relation || "in", id });
}

/**
 * rows after a place was chosen in row `index`: when it's the only place and it has a parent, the
 * parent goes in as the second place ("in"), filling an empty second row or adding one.
 */
export function withParent(rows: PhotoPlace[], index: number, places: Place[]): PhotoPlace[] {
  const parent = parentToAdd(rows, index, places);
  return parent ? withOther(rows, index, parent) : rows;
}

/** Whether the second row's place is in the first row's, so they're the wrong way around. */
function generalFirst(rows: PhotoPlace[], places: Place[]): boolean {
  const [first = "", second = ""] = rows.map((row) => row.id);
  return first !== "" && isAbove(places, first, second);
}

/**
 * rows with the more specific place first: when the first place is one the second is in, the two
 * places swap, each relation staying in its row.
 */
export function specificFirst(rows: PhotoPlace[], places: Place[]): PhotoPlace[] {
  if (!generalFirst(rows, places)) return rows;
  const ids = rows.map((row) => row.id).toReversed();
  return rows.map((row, index) => ({ ...row, id: ids[index] ?? row.id }));
}

/** Whether child and parent are two places neither of which is in the other, child with no parent. */
function unrelated(places: Place[], child: Place, parent: Place): boolean {
  if (child.parent || child.id === parent.id) return false;
  return !isAbove(places, child.id, parent.id);
}

/**
 * When two places are chosen and neither is in the other, the first (more specific) one with no
 * parent yet and the second, to offer putting the first in the second.
 */
export function unrelatedPair(rows: PhotoPlace[], places: Place[]) {
  const [child, parent] = chosen(rows).map((row) => byId(places, row.id));
  if (!child || !parent) return undefined;
  return unrelated(places, child, parent) ? { child, parent } : undefined;
}

/** The least specific chosen place: one the others are in, or else the last chosen. */
function leastSpecific(rows: PhotoPlace[], places: Place[]): Place | undefined {
  const ids = chosen(rows).map((row) => row.id);
  const top = ids.find((id) => ids.every((other) => other === id || isAbove(places, id, other)));
  return byId(places, top ?? ids.at(-1));
}

function hasCity(place: Place): boolean {
  return Boolean(place.city?.trim() || place.country?.trim());
}

/** The places to take a city from, in order: the least specific, the places it's in, then the rest. */
function cityCandidates(rows: PhotoPlace[], places: Place[]): Place[] {
  const least = leastSpecific(rows, places);
  const others = chosen(rows).flatMap((row) => byId(places, row.id) ?? []);
  return least ? [least, ...ancestors(places, least.id), ...others] : [];
}

/**
 * The city and country a photo with these places takes: from the least specific place, or else the
 * places it's in, or else the other chosen places; undefined when none has a city or country.
 */
export function placeCity(rows: PhotoPlace[], places: Place[]) {
  const place = cityCandidates(rows, places).find(hasCity);
  return place && { city: place.city?.trim() ?? "", country: place.country?.trim() ?? "" };
}

/** What the United States goes by in photos' and places' countries, lowercase. */
const UNITED_STATES = new Set([
  "united states",
  "united states of america",
  "usa",
  "us",
  "u.s.",
  "u.s.a.",
  "america",
]);

/** Whether country is the United States; false when it's empty, since that isn't known. */
export function isUnitedStates(country: string): boolean {
  return UNITED_STATES.has(country.trim().toLowerCase());
}

/** Whether the localization has anything written in it. */
function isWritten(found: Localization): boolean {
  return [found.romanization, found.pronunciation, found.localScript].some(Boolean);
}

/** Whether the place has a saved localization with anything in it. */
export function isLocalized(place: Place, localizations: Localization[]): boolean {
  const id = localizationId("place", place.name, place.id);
  return localizations.some((l) => l.id === id && isWritten(l));
}
