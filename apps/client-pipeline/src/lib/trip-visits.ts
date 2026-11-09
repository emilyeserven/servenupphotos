import type { Place } from "@/api/places";
import type { TripPoint, TripVisit, VisitKind } from "@/api/trip-lines";
import { changedItem, withItem, type GapDraft } from "@/lib/trip-gaps";

/** The sorts of place a visit can be, as the menu lists them. */
export const VISIT_KINDS: { kind: VisitKind; label: string }[] = [
  { kind: "restaurant", label: "Restaurant" },
  { kind: "cafe", label: "Café" },
  { kind: "bar", label: "Bar" },
  { kind: "shop", label: "Shop" },
  { kind: "museum", label: "Museum" },
  { kind: "sight", label: "Sight" },
  { kind: "station", label: "Station" },
  { kind: "other", label: "Other" },
];

/** A new, unnamed restaurant at the point clicked. */
export function newVisit({ latitude, longitude }: TripPoint): TripVisit {
  return { name: "", kind: "restaurant", latitude, longitude };
}

/** The station found by name as a trip stop, named after it. */
export function stationVisit({ label, latitude, longitude }: TripPoint): TripVisit {
  return { name: label ?? "", kind: "station", latitude, longitude };
}

/** The saved place as a visit, named after it. */
export function placeVisit(place: Place & TripPoint): TripVisit {
  const { id, name, latitude, longitude } = place;
  return { name, kind: "sight", latitude, longitude, place: id };
}

/** The draft with the visit added. */
export function withVisit(draft: GapDraft, visit: TripVisit): GapDraft {
  return withItem(draft, "visits", visit);
}

/** The draft with visit i changed, or removed for null. */
export function changedVisit(draft: GapDraft, i: number, visit: TripVisit | null): GapDraft {
  return changedItem(draft, "visits", i, visit);
}

/** Whether the place has a GPS position. */
function located(place: Place): place is Place & TripPoint {
  return place.latitude !== undefined && place.longitude !== undefined;
}

/** How far apart two spots are, in degrees with longitude scaled to the latitude. */
function apart(a: TripPoint, b: TripPoint): number {
  const scale = Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot((a.longitude - b.longitude) * scale, a.latitude - b.latitude);
}

/** About 10 km, in degrees. */
const NEAR = 0.09;

/** The saved places within about 10 km of any of the spots, such as the day's photos, nearest first. */
export function placesNear(places: Place[], spots: TripPoint[]): (Place & TripPoint)[] {
  const distance = (p: TripPoint) => Math.min(...spots.map((spot) => apart(p, spot)));
  return places
    .filter(located)
    .map((place) => ({ place, d: distance(place) }))
    .filter(({ d }) => d <= NEAR)
    .toSorted((a, b) => a.d - b.d)
    .map(({ place }) => place);
}

/** Whether the link is a web address the page can open. */
export function webLink(link: string | undefined): boolean {
  return /^https?:\/\/\S+$/.test(link ?? "");
}

/** The trip stops put on the route right after photo id, in the order added. */
export function visitsAfter(visits: TripVisit[] | undefined, id: number | undefined): TripVisit[] {
  return (visits ?? []).filter((v) => v.after !== undefined && v.after === id);
}

/** The trip stops put on the route before the day's first photo, in the order added. */
export function firstStops(visits: TripVisit[] | undefined): TripVisit[] {
  return (visits ?? []).filter((v) => v.first);
}

/** Where a trip stop is on the route: after a photo, before the first photo, or neither (off it). */
type StopPlace = Pick<TripVisit, "after" | "first">;

/**
 * The draft with the visit put on the route one photo earlier (-1) or later (1) among ids, the day's
 * photos in order: from after the first photo to before it, and back; unchanged when it's off the
 * route or would go past the first or last gap.
 */
export function movedVisit(draft: GapDraft, visit: TripVisit, ids: number[], by: -1 | 1): GapDraft {
  const to = neighbourPlace(ids, visit, by);
  return to === undefined ? draft : withPlace(draft, visit, to);
}

/** The place `by` photos from the visit's among ids, when there is one there; none otherwise. */
function neighbourPlace(
  ids: number[],
  { after, first }: TripVisit,
  by: -1 | 1,
): StopPlace | undefined {
  const at = first ? -1 : after === undefined ? undefined : ids.indexOf(after);
  if (at === undefined || (at === -1 && !first)) return undefined;
  if (at + by === -1) return { first: true };
  const to = ids.slice(0, -1)[at + by];
  return to === undefined ? undefined : { after: to };
}

/** The draft with the visit at place, its old place dropped. */
function withPlace(draft: GapDraft, visit: TripVisit, place: StopPlace): GapDraft {
  const visits = (draft.visits ?? []).map((v) => {
    if (v !== visit) return v;
    const { after: _after, first: _first, ...rest } = v;
    return { ...rest, ...place };
  });
  return { ...draft, visits };
}

/**
 * The draft with one of its trip stops put on the route right after photo `after`, or taken
 * off it with undefined.
 */
export function placedVisit(
  draft: GapDraft,
  visit: TripVisit,
  after: number | undefined,
): GapDraft {
  return withPlace(draft, visit, after === undefined ? {} : { after });
}

/** The trip stops not on the route yet, which the photo strip can put between two photos. */
export function offRoute(visits: TripVisit[] | undefined): TripVisit[] {
  return (visits ?? []).filter((v) => v.after === undefined && !v.first);
}
