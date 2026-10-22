import type { Place } from "@/api/places";
import { notParentsOf } from "@/lib/place-hierarchy";

/** What bulk editing sets on every selected place; an empty field leaves each place's own. */
export interface BulkChange {
  city: string;
  /** The city's country when it's known, set with the city. */
  country?: string;
  /** The ID of the place they're all put in. */
  parent: string;
}

/** The places none of the selected ones can be put in: themselves, and every place in one of them. */
export function bulkNotParents(places: Place[], selected: Place[]): Set<string> {
  return new Set(selected.flatMap((place) => [...notParentsOf(places, place.id)]));
}

/** A combobox option for each place not ruled out as a parent, sorted by name. */
export function parentOptions(places: Place[], ruledOut: Set<string>) {
  return places
    .filter((place) => !ruledOut.has(place.id))
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((place) => ({ value: place.id, label: place.name }));
}

/** The place with the city (and its country, when known) and parent that are set in change. */
function withChange(place: Place, { city, country, parent }: BulkChange): Place {
  const next = { ...place };
  if (city) Object.assign(next, { city, country: country || place.country });
  if (parent) next.parent = parent;
  return next;
}

/** Whether the city, country or parent differ. */
function differs(a: Place, b: Place): boolean {
  return a.city !== b.city || a.country !== b.country || a.parent !== b.parent;
}

/** The selected places as the change would save them, leaving out those it doesn't change. */
export function bulkChanged(selected: Place[], change: BulkChange): Place[] {
  return selected.flatMap((place) => {
    const next = withChange(place, change);
    return differs(next, place) ? [next] : [];
  });
}
