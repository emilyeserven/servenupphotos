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

/**
 * The same place visited again, such as a station gone back to by car: a copy of the visit off the
 * route, so its Where on the route menu can put it somewhere else, without the casual photos taken
 * on the first visit.
 */
export function againVisit({
  after: _after,
  first: _first,
  photos: _photos,
  ...place
}: TripVisit): TripVisit {
  return place;
}

/** Whether the stop has any of its own localized names written: romanization, pronunciation or local script. */
export function hasStopNames({ romanization, pronunciation, localScript }: TripVisit): boolean {
  return [romanization, pronunciation, localScript].some((name) => (name ?? "").trim() !== "");
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
 * The draft with the visit moved one spot earlier (-1) or later (1) on the route among ids, the day's
 * photos in order: first past the next stop at the same place, such as two stops after one photo,
 * then on to the place one photo away, from after the first photo to before it, and back, and on to
 * after the last photo, where the line ends at it. It lands at the near end of the stops already
 * there. Unchanged when it's off the route or would go before the first photo's stops or past the
 * last photo.
 */
export function movedVisit(draft: GapDraft, visit: TripVisit, ids: number[], by: -1 | 1): GapDraft {
  const visits = draft.visits ?? [];
  const at = visits.indexOf(visit);
  const sibling = siblingIndex(visits, at, by);
  if (sibling !== undefined) return { ...draft, visits: swapped(visits, at, sibling) };
  const to = neighbourPlace(ids, visit, by);
  return to === undefined ? draft : withPlace(draft, visit, to, by);
}

/** The index of the nearest stop at the same place as visits[at] in direction by; none when none. */
function siblingIndex(visits: TripVisit[], at: number, by: -1 | 1): number | undefined {
  const here = visits[at];
  if (!here || !onRoute(here)) return undefined;
  for (let i = at + by; i >= 0 && i < visits.length; i += by) {
    if (samePlace(visits[i]!, here)) return i;
  }
  return undefined;
}

/** Whether a trip stop is on the route. */
function onRoute({ after, first }: TripVisit): boolean {
  return first === true || after !== undefined;
}

/** Whether two trip stops are at the same place on the route. */
function samePlace(a: StopPlace, b: StopPlace): boolean {
  return (a.first ?? false) === (b.first ?? false) && a.after === b.after;
}

/** The list with the items at i and j swapped. */
function swapped<T>(list: T[], i: number, j: number): T[] {
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
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
  const to = ids[at + by];
  return to === undefined ? undefined : { after: to };
}

/**
 * The draft with the visit at place, its old place dropped. Coming from a later place (by -1) it goes
 * after the stops already there, and from an earlier one (by 1) before them, so it lands next to
 * where it was; without by it keeps its order in the list.
 */
function withPlace(draft: GapDraft, visit: TripVisit, place: StopPlace, by?: -1 | 1): GapDraft {
  const { after: _after, first: _first, ...rest } = visit;
  const moved = { ...rest, ...place };
  const others = (draft.visits ?? []).filter((v) => v !== visit);
  if (by === undefined) {
    return { ...draft, visits: (draft.visits ?? []).map((v) => (v === visit ? moved : v)) };
  }
  const there = others.flatMap((v, i) => (samePlace(v, place) ? [i] : []));
  const at = there.length === 0 ? others.length : by < 0 ? there.at(-1)! + 1 : there[0]!;
  return { ...draft, visits: [...others.slice(0, at), moved, ...others.slice(at)] };
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

/** The draft with one of its trip stops put on the route before the day's first photo. */
export function firstVisit(draft: GapDraft, visit: TripVisit): GapDraft {
  return withPlace(draft, visit, { first: true });
}

/** The trip stops not on the route yet, which the photo strip can put between two photos. */
export function offRoute(visits: TripVisit[] | undefined): TripVisit[] {
  return (visits ?? []).filter((v) => v.after === undefined && !v.first);
}
