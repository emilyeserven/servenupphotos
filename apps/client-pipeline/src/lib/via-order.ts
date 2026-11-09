import type { TripPoint, TripSegment } from "@/api/trip-lines";
import { walkKey, walkOfKey } from "@/lib/station-walks";
import type { GapDraft, ViaKey } from "@/lib/trip-gaps";

/** A via point with where it is in the draft: the list after `key`, at `index`. */
export interface PlacedVia {
  key: ViaKey;
  index: number;
  point: TripPoint;
}

/**
 * The via lists a segment's line goes through, in order: for a hop with a line picked, its walks to
 * the station it got on at and from the one it got off at; for a hop without one, the list after its
 * first photo (or the start spot's, for the hop from the start); for a walk, the start spot's and each photo's but the last (whose via points lead to
 * the next segment), unless the walk ends at the end spot.
 */
function segmentKeys(segment: TripSegment): ViaKey[] {
  const [a] = segment.photos;
  if (segment.mode === "wander" || a === undefined) return [];
  if (segment.line) return stationKeys(segment, a);
  if (segment.mode !== "walk") return [segment.start ? "start" : String(a)];
  const photos = segment.end ? segment.photos : segment.photos.slice(0, -1);
  return [...(segment.start ? ["start"] : []), ...photos.map(String)];
}

/** The via lists of a hop with a line from photo a: its walks to and from its stations. */
function stationKeys(segment: TripSegment, a: number): ViaKey[] {
  return [
    ...(segment.board ? [walkKey("board", a)] : []),
    ...(segment.alight ? [walkKey("alight", a)] : []),
  ];
}

/**
 * The via lists' keys in the order the route goes through them (`living`), then any the draft still
 * has that the route no longer goes through (`rest`), such as after a photo left the line.
 */
function routeKeys(draft: GapDraft, segments: TripSegment[]) {
  const living = [...new Set(segments.flatMap(segmentKeys))];
  const rest = Object.keys(draft.via ?? {}).filter((k) => !living.includes(k));
  return { living, all: [...living, ...rest] };
}

/** Every via point in the draft, in the order the route goes through them, as the map numbers them. */
export function viasInRouteOrder(draft: GapDraft, segments: TripSegment[]): PlacedVia[] {
  return routeKeys(draft, segments).all.flatMap((key) =>
    (draft.via?.[key] ?? []).map((point, index) => ({ key, index, point })),
  );
}

/**
 * Where a via point moved one place earlier (-1) or later (+1) lands: the next place in its own
 * list, or else the end of the stretch before it or the start of the stretch after it, past the
 * photo or station between them; none at either end of the route.
 */
function landing(
  draft: GapDraft,
  segments: TripSegment[],
  via: PlacedVia,
  step: -1 | 1,
): Place | undefined {
  return withinList(draft, via, step) ?? acrossLists(draft, segments, via.key, step);
}

/** A place in the draft's via lists: the list after `key`, at `index`. */
type Place = Pick<PlacedVia, "key" | "index">;

/** The next place in the via point's own list; none at its ends. */
function withinList(draft: GapDraft, { key, index }: PlacedVia, step: -1 | 1): Place | undefined {
  const to = index + step;
  return to >= 0 && to < (draft.via?.[key]?.length ?? 0) ? { key, index: to } : undefined;
}

/** The end of the stretch before key's, or the start of the one after; none when the route has none. */
function acrossLists(
  draft: GapDraft,
  segments: TripSegment[],
  key: ViaKey,
  step: -1 | 1,
): Place | undefined {
  const { living, all } = routeKeys(draft, segments);
  const next = all[all.indexOf(key) + step];
  if (next === undefined || !living.includes(next)) return undefined;
  return { key: next, index: step === -1 ? (draft.via?.[next]?.length ?? 0) : 0 };
}

/** Whether a via point can move one place earlier (-1) or later (+1) along the route. */
export function canMove(
  draft: GapDraft,
  segments: TripSegment[],
  via: PlacedVia,
  step: -1 | 1,
): boolean {
  return landing(draft, segments, via, step) !== undefined;
}

/**
 * The draft with a via point moved one place earlier (-1) or later (+1) along the route: swapped
 * with its neighbor in the same stretch, or moved past the photo or station at the stretch's end
 * into the next stretch. The draft as it was at either end of the route.
 */
export function movedInRoute(
  draft: GapDraft,
  segments: TripSegment[],
  via: PlacedVia,
  step: -1 | 1,
): GapDraft {
  const to = landing(draft, segments, via, step);
  if (!to) return draft;
  const from = (draft.via?.[via.key] ?? []).filter((_, i) => i !== via.index);
  const lists = { ...draft.via, [via.key]: from };
  const target = [...(lists[to.key] ?? [])];
  target.splice(to.index, 0, via.point);
  return { ...draft, via: { ...lists, [to.key]: target } };
}

/**
 * The photo the stretch after key leads to, by the day's photo ids in order: the first photo after
 * the start spot, the photo a walk to or from a station is on the way to, or the photo after key's;
 * none for the stretch to the end spot.
 */
export function photoAfter(
  key: ViaKey,
  ids: number[],
  segments: TripSegment[],
): number | undefined {
  if (key === "start") return ids[0];
  const walk = walkOfKey(key);
  if (walk) return segments.find((s) => s.line && s.photos[0] === walk.a)?.photos[1];
  const at = ids.indexOf(Number(key));
  return at === -1 ? undefined : ids[at + 1];
}
