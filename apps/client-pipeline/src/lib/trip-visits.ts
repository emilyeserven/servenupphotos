import type { Place } from "@/api/places";
import type { TripPoint, TripVisit, VisitKind } from "@/api/trip-lines";
import type { GapDraft } from "@/lib/trip-gaps";

/** The sorts of place a visit can be, as the menu lists them. */
export const VISIT_KINDS: { kind: VisitKind; label: string }[] = [
  { kind: "restaurant", label: "Restaurant" },
  { kind: "cafe", label: "Café" },
  { kind: "bar", label: "Bar" },
  { kind: "shop", label: "Shop" },
  { kind: "museum", label: "Museum" },
  { kind: "sight", label: "Sight" },
  { kind: "other", label: "Other" },
];

/** A new, unnamed restaurant at the point clicked. */
export function newVisit({ latitude, longitude }: TripPoint): TripVisit {
  return { name: "", kind: "restaurant", latitude, longitude };
}

/** The saved place as a visit, named after it. */
export function placeVisit(place: Place & TripPoint): TripVisit {
  const { id, name, latitude, longitude } = place;
  return { name, kind: "sight", latitude, longitude, place: id };
}

/** The draft with the visit added. */
export function withVisit(draft: GapDraft, visit: TripVisit): GapDraft {
  return { ...draft, visits: [...(draft.visits ?? []), visit] };
}

/** The draft with visit i changed, or removed for null. */
export function changedVisit(draft: GapDraft, i: number, visit: TripVisit | null): GapDraft {
  const visits = (draft.visits ?? []).flatMap((v, n) => (n !== i ? [v] : visit ? [visit] : []));
  return { ...draft, visits };
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

/**
 * The draft with the visit put on the route one photo earlier (-1) or later (1) among ids, the day's
 * photos in order; unchanged when it's off the route or would go past the first or last gap.
 */
export function movedVisit(draft: GapDraft, visit: TripVisit, ids: number[], by: -1 | 1): GapDraft {
  const to = neighbourAfter(ids, visit.after, by);
  return to === undefined ? draft : placedVisit(draft, visit, to);
}

/** The photo `by` places from photo `after` among ids, when a gap follows it; none otherwise. */
function neighbourAfter(ids: number[], after: number | undefined, by: -1 | 1): number | undefined {
  const at = after === undefined ? -1 : ids.indexOf(after);
  return at === -1 ? undefined : ids.slice(0, -1)[at + by];
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
  const visits = (draft.visits ?? []).map((v) => (v === visit ? { ...v, after } : v));
  return { ...draft, visits };
}

/** The trip stops not on the route yet, which the photo strip can put between two photos. */
export function offRoute(visits: TripVisit[] | undefined): TripVisit[] {
  return (visits ?? []).filter((v) => v.after === undefined);
}
