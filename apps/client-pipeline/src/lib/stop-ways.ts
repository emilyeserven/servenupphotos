import type { TripPoint, TripSegment, TripVia, TripVisit } from "@/api/trip-lines";

/**
 * A trip stop can say how it was reached from the point before it on the route (its `mode`), such
 * as a walk between two stations in the middle of a train ride. The segments the gaps make are cut
 * at such stops, each stretch its own segment in its own mode. A train, subway, bus or transit hop
 * is also cut at every trip stop on it, such as a station changed trains at, so each stretch can
 * name the line it rode; any other stop with no mode, or the mode of the stretch it's on, leaves
 * its segment whole.
 */

/** One point of a segment's line, in order: a spot with no photo, a photo, or a via spot. */
type Item = { point: TripPoint } | { photo: number } | { via: TripVia };

/** The segment's points in the order its line goes through them. */
function itemsOf(s: TripSegment): Item[] {
  const via = s.via ?? [];
  const after = (id: number | undefined) =>
    via.filter((v) => v.after === id).map((v): Item => ({ via: v }));
  return [
    ...(s.start ? [{ point: s.start }] : []),
    ...after(undefined),
    ...s.photos.flatMap((id) => [{ photo: id }, ...after(id)]),
    ...(s.end ? [{ point: s.end }] : []),
  ];
}

/** The trip stop a point stands for: a via spot's visit, or the end spot when it's a stop. */
function stopOf(item: Item, visits: TripVisit[], endStop: number): TripVisit | undefined {
  if ("via" in item) return item.via.visit === undefined ? undefined : visits[item.via.visit];
  return "point" in item && endStop >= 0 ? visits[endStop] : undefined;
}

/**
 * The index of the trip stop the segment's end spot stands for: the last one put after its last
 * photo, at that spot; -1 when the end is a spot of its own.
 */
function endStopOf(s: TripSegment, visits: TripVisit[]): number {
  const end = s.end;
  if (!end) return -1;
  return visits.findLastIndex(
    (v) =>
      !v.first &&
      v.after === s.photos.at(-1) &&
      v.latitude === end.latitude &&
      v.longitude === end.longitude,
  );
}

/** Whether the item is a via spot of the segment's own, there to shape it, not a trip stop. */
function ownVia(item: Item): boolean {
  return "via" in item && item.via.visit === undefined;
}

/**
 * How each point after the first was reached: a trip stop's own mode, or else the segment's. A via
 * spot of the segment's own goes with the stretch it's on the way to, so a cut is never at one.
 */
function modesOf(s: TripSegment, items: Item[], visits: TripVisit[]): string[] {
  const endStop = endStopOf(s, visits);
  const into = items.map((item, i) => {
    const stop = stopOf(item, visits, i === items.length - 1 ? endStop : -1);
    return stop?.mode ?? s.mode;
  });
  for (let i = items.length - 2; i >= 0; i--) {
    if (ownVia(items[i]!)) into[i] = into[i + 1]!;
  }
  return into.slice(1);
}

/** The point an item is drawn at, named for a trip stop. */
function pointOf(item: Item, visits: TripVisit[]): TripPoint {
  if ("point" in item) return item.point;
  const v = "via" in item ? item.via : undefined;
  const label = v?.visit === undefined ? undefined : visits[v.visit]?.name;
  return { latitude: v!.latitude, longitude: v!.longitude, ...(label && { label }) };
}

/** The stretch of items from index a to b, both included, as a segment in mode. */
function stretchOf(items: Item[], a: number, b: number, mode: string, visits: TripVisit[]) {
  const photos: number[] = [];
  const via: TripVia[] = [];
  let start: TripPoint | undefined;
  let end: TripPoint | undefined;
  items.slice(a, b + 1).forEach((item, i) => {
    const edge = i === 0 || i === b - a;
    if ("photo" in item) photos.push(item.photo);
    else if (edge && i === 0) start = pointOf(item, visits);
    else if (edge) end = pointOf(item, visits);
    else via.push(keptVia((item as { via: TripVia }).via, photos));
  });
  return { mode, photos, start, end, via };
}

/** A via spot in a stretch: after its photo, or right after the start when its photo isn't there. */
function keptVia({ after, ...v }: TripVia, photos: number[]): TripVia {
  return after !== undefined && photos.includes(after) ? { after, ...v } : v;
}

/** The modes whose hops can name the line they rode. */
export const LINE_MODES: ReadonlySet<string> = new Set(["train", "subway", "bus", "transit"]);

/**
 * Whether the stretch into item i+1 ends there: the way travelled changes after it, or it's a trip
 * stop on a hop that names its lines, or it's the last item.
 */
function endsAt(items: Item[], modes: string[], i: number, byStop: boolean): boolean {
  if (i + 1 === modes.length || modes[i + 1] !== modes[i]) return true;
  const item = items[i + 1]!;
  return byStop && "via" in item && item.via.visit !== undefined;
}

/** The segment cut where the way travelled changes, each stretch in its own mode. */
function cut(s: TripSegment, visits: TripVisit[]): TripSegment[] {
  const items = itemsOf(s);
  const modes = modesOf(s, items, visits);
  const byStop = LINE_MODES.has(s.mode);
  if (!modes.some((_, i) => i + 1 < modes.length && endsAt(items, modes, i, byStop))) return [s];
  const out: TripSegment[] = [];
  let from = 0;
  modes.forEach((mode, i) => {
    if (!endsAt(items, modes, i, byStop)) return;
    out.push(
      fieldsOf(s, stretchOf(items, from, i + 1, mode, visits), from === 0, i + 2 === items.length),
    );
    from = i + 1;
  });
  return out;
}

/** A stretch as a segment of s, with s's area exit or entrance at its first or last end. */
function fieldsOf(
  s: TripSegment,
  { mode, photos, start, end, via }: ReturnType<typeof stretchOf>,
  first: boolean,
  last: boolean,
): TripSegment {
  return {
    mode: mode as TripSegment["mode"],
    ...(start && { start }),
    photos,
    ...(end && { end }),
    ...(via.length > 0 && { via }),
    ...(first && s.from && { from: s.from }),
    ...(last && s.to && { to: s.to }),
  };
}

/**
 * The segments cut at the trip stops reached some other way than the stretch they're on, and at
 * every trip stop on a hop that names its lines.
 */
export function cutAtStopWays(segments: TripSegment[], visits: TripVisit[] = []): TripSegment[] {
  if (visits.length === 0) return segments;
  return segments.flatMap((s) => (s.mode === "wander" ? [s] : cut(s, visits)));
}

/**
 * The way travelled between photos a and b when trip stops between them cut it: the mode of the
 * stretch from the last stop to b, which is the way the gap was travelled.
 */
export function cutGap(segments: TripSegment[], a: number, b: number): string | undefined {
  return segments.find((s) => s.start && s.photos[0] === b && !s.photos.includes(a))?.mode;
}
