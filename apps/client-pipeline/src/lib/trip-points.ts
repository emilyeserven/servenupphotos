import type { TripPoint, TripSegment, TripVia } from "@/api/trip-lines";
import type { TripPhoto } from "@/lib/trip-days";
import type { GapDraft, ViaKey } from "@/lib/trip-gaps";

/** A point as [longitude, latitude], as GeoJSON writes it. */
export type LngLat = [number, number];

/**
 * A point a segment's line goes through, and where a via spot added right after it goes: the list
 * of via spots after `key`, at `index + 1` (an anchor, a start spot or photo, has index -1).
 */
export interface LinePoint {
  at: LngLat;
  key: ViaKey;
  index: number;
}

function lngLat(p: TripPoint | TripPhoto | TripVia): LngLat {
  return [p.longitude, p.latitude];
}

/** The via spots after key, as line points. */
function viaPoints(via: TripVia[], key: ViaKey, after: number | undefined): LinePoint[] {
  const mine = via.filter((v) => v.after === after);
  return mine.map((v, index) => ({ at: lngLat(v), key, index }));
}

/** The start spot and its via spots, as line points. */
function startPoints(segment: TripSegment): LinePoint[] {
  if (!segment.start) return [];
  const anchor = { at: lngLat(segment.start), key: "start", index: -1 };
  return [anchor, ...viaPoints(segment.via ?? [], "start", undefined)];
}

/** A photo and its via spots, as line points; none when the photo isn't on the day. */
function photoPoints(segment: TripSegment, id: number, byId: Map<number, TripPhoto>): LinePoint[] {
  const photo = byId.get(id);
  if (!photo) return [];
  const key = String(id);
  const at = lngLat(areaEnd(segment, id) ?? photo);
  return [{ at, key, index: -1 }, ...viaPoints(segment.via ?? [], key, id)];
}

/**
 * The spot drawn instead of photo id: the exit of the area the segment's first photo is in, or the
 * entrance of the area its last one is in, when set (as after wandering a park); none otherwise.
 */
function areaEnd(segment: TripSegment, id: number): TripPoint | undefined {
  if (id === segment.photos[0] && segment.from) return segment.from;
  return id === segment.photos.at(-1) ? segment.to : undefined;
}

/** The end spot, as a line point; nothing comes after it. */
function endPoints(segment: TripSegment): LinePoint[] {
  return segment.end ? [{ at: lngLat(segment.end), key: "end", index: -1 }] : [];
}

/** The points the segment's line goes through, in order: its start, its photos, its via spots, its end. */
export function linePoints(segment: TripSegment, byId: Map<number, TripPhoto>): LinePoint[] {
  const photos = segment.photos.flatMap((id) => photoPoints(segment, id, byId));
  return [...startPoints(segment), ...photos, ...endPoints(segment)];
}

/** How far p is from the line from a to b, in degrees with longitude scaled to the latitude. */
function distanceToLeg(p: LngLat, a: LngLat, b: LngLat): number {
  const scale = Math.cos((p[1] * Math.PI) / 180);
  const [ax, ay, bx, by, px, py] = [a[0] * scale, a[1], b[0] * scale, b[1], p[0] * scale, p[1]];
  const length = (bx - ax) ** 2 + (by - ay) ** 2;
  const t =
    length === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / length));
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
}

/**
 * The point a leg starts at for each leg of the segments' lines, with how far p is from it. A hop
 * with a line picked follows the line's track, so a via spot never goes on it.
 */
function legs(segments: TripSegment[], byId: Map<number, TripPhoto>, p: LngLat) {
  return segments.filter((segment) => !segment.line).flatMap((segment) => {
    const points = linePoints(segment, byId);
    return points.slice(1).map((b, i) => {
      const a = points[i] as LinePoint;
      return { from: a, distance: distanceToLeg(p, a.at, b.at) };
    });
  });
}

/**
 * The draft with a via spot at point, put in the leg of the drawn lines nearest it, so the line
 * bends through it there; the draft as it was when no line is drawn.
 */
export function withVia(
  draft: GapDraft,
  segments: TripSegment[],
  photos: TripPhoto[],
  point: TripPoint,
): GapDraft {
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const nearest = legs(segments, byId, lngLat(point)).toSorted(
    (x, y) => x.distance - y.distance,
  )[0];
  if (!nearest) return draft;
  const { key, index } = nearest.from;
  const list = [...(draft.via?.[key] ?? [])];
  list.splice(index + 1, 0, { latitude: point.latitude, longitude: point.longitude });
  return { ...draft, via: { ...draft.via, [key]: list } };
}

/** The draft with via spot index after key moved to point, or removed when point is null. */
export function movedVia(
  draft: GapDraft,
  key: ViaKey,
  index: number,
  point: TripPoint | null,
): GapDraft {
  const list = (draft.via?.[key] ?? []).flatMap((v, i) =>
    i !== index ? [v] : point ? [point] : [],
  );
  return { ...draft, via: { ...draft.via, [key]: list } };
}

/** Every via spot in the draft, with where it is in it. */
export function draftVias(draft: GapDraft): { key: ViaKey; index: number; point: TripPoint }[] {
  return Object.entries(draft.via ?? {}).flatMap(([key, list]) =>
    list.map((point, index) => ({ key, index, point })),
  );
}
