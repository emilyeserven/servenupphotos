import type { TripSegment } from "@/api/trip-lines";
import { LINE_MODES } from "@/lib/stop-ways";
import type { Ride } from "@/lib/transit-ride";
import { type Gap, type GapDraft, segmentKey } from "@/lib/trip-gaps";

/**
 * Whether the segment is a hop, or one leg of a hop cut at a trip stop, that can name the line it
 * rode: it runs straight between two points, a photo, the day's start or a trip stop.
 */
export function ridesLine(segment: TripSegment): boolean {
  const points = segment.photos.length + (segment.start ? 1 : 0) + (segment.end ? 1 : 0);
  return LINE_MODES.has(segment.mode) && points === 2;
}

/** The draft's lines without the one for the leg with key. */
function without(lines: GapDraft["lines"], key: string): GapDraft["lines"] {
  return Object.fromEntries(Object.entries(lines ?? {}).filter(([k]) => k !== key));
}

/**
 * The draft with the leg known by key (`legKeys`) on the ride, or riding no line (drawn straight)
 * for undefined.
 */
export function withHopLine(draft: GapDraft, hop: TripSegment, key: string, ride?: Ride): GapDraft {
  if (!ride) return { ...draft, lines: without(draft.lines, key) };
  const { path, ...picked } = ride;
  const lines = { ...draft.lines, [key]: { mode: hop.mode as Gap, ...picked } };
  const ridden: TripSegment = { ...hop, ...picked, path: undefined };
  return { ...draft, lines, paths: { ...draft.paths, [segmentKey(ridden)]: path } };
}
