import type { TripVisit } from "@/api/trip-lines";
import { type Gap, type GapDraft, withGap } from "@/lib/trip-gaps";
import { againVisit, firstVisit, offRoute, placedVisit } from "@/lib/trip-visits";

/** Whether the trip stop is on the route: after a photo, or before the day's first. */
function onRoute(visit: TripVisit): boolean {
  return visit.after !== undefined || visit.first === true;
}

/** Whether two stops are the same place: the same name at the same spot. */
function samePlace(a: TripVisit, b: TripVisit): boolean {
  return a.name === b.name && a.latitude === b.latitude && a.longitude === b.longitude;
}

/**
 * The trip stops the photo strip can put somewhere on the route: the ones not on it yet, then each
 * place already on it once, which goes on again as a second visit, such as a ropeway's bottom
 * station gone up from and come back down to.
 */
export function insertChoices(visits: TripVisit[] | undefined): TripVisit[] {
  const off = offRoute(visits);
  const again: TripVisit[] = [];
  for (const v of visits ?? []) {
    if (onRoute(v) && ![...off, ...again].some((o) => samePlace(o, v))) again.push(v);
  }
  return [...off, ...again];
}

/** Whether a choice from insertChoices goes on as a second visit to a place already on the route. */
export function isAgain(visit: TripVisit): boolean {
  return onRoute(visit);
}

/** Where a trip stop goes on the route: right after a photo, or before the day's first. */
type Place = { after: number } | { first: true };

/**
 * The draft with the trip stop put on the route at place: moved there when it isn't on the route
 * yet, or else a copy of it added there (a second visit), leaving the first where it is.
 */
export function insertedVisit(draft: GapDraft, visit: TripVisit, place: Place): GapDraft {
  if (!onRoute(visit)) {
    return "first" in place ? firstVisit(draft, visit) : placedVisit(draft, visit, place.after);
  }
  return { ...draft, visits: [...(draft.visits ?? []), { ...againVisit(visit), ...place }] };
}

/** The ways a trip stop can be reached from the point before it: any but a break or a wander. */
export type StopWay = NonNullable<TripVisit["mode"]>;

/** Whether the gap is a way a stop can be reached, not a break or a wander. */
function isWay(gap: Gap): gap is StopWay {
  return gap !== "break" && gap !== "wander";
}

/**
 * How a trip stop between two photos was reached, as the picker before it shows it: its own way,
 * or else the gap's; none in a break or a wander, where it has no way of its own to pick.
 */
export function stopWay(visit: TripVisit, gap: Gap): StopWay | undefined {
  if (!isWay(gap)) return undefined;
  return visit.mode ?? gap;
}

/** The draft with the trip stop reached by way from the point before it. */
export function withStopWay(draft: GapDraft, visit: TripVisit, way: StopWay): GapDraft {
  const visits = (draft.visits ?? []).map((v) => (v === visit ? { ...v, mode: way } : v));
  return { ...draft, visits };
}

/**
 * The draft with the gap at index changed to gap, the way after the last of its trip stops. Each
 * stop in it that went the gap's way keeps the old way, so the stretches before the stops don't
 * change with it: a car to a station and a walk from it stay a car and a walk.
 */
export function withGapKeepingStops(
  draft: GapDraft,
  stops: TripVisit[],
  index: number,
  gap: Gap,
): GapDraft {
  const old = draft.gaps[index];
  const kept = old && isWay(old) ? old : undefined;
  if (!kept || stops.length === 0) return withGap(draft, index, gap);
  const visits = (draft.visits ?? []).map((v) =>
    stops.includes(v) && !v.mode ? { ...v, mode: kept } : v,
  );
  return withGap({ ...draft, visits }, index, gap);
}
