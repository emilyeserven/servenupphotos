import type { TripSegment, TripTransitLine } from "@/api/trip-lines";
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

/**
 * The draft with the leg known by key riding a line named by hand, such as "Super HAGI" for a bus no
 * source has: drawn as before (along the streets, when it was), and named on the map.
 */
export function withNamedLine(
  draft: GapDraft,
  hop: TripSegment,
  key: string,
  name: string,
): GapDraft {
  const line: TripTransitLine = { id: 0, name: name.trim(), source: "named" };
  const lines = { ...draft.lines, [key]: { mode: hop.mode as Gap, line } };
  const plain: TripSegment = { ...hop, line: undefined, board: undefined, alight: undefined };
  const path = draft.paths?.[segmentKey(plain)];
  if (!path) return { ...draft, lines };
  return { ...draft, lines, paths: { ...draft.paths, [segmentKey({ ...plain, line })]: path } };
}

/** Whether the line was named by hand, so it has no stops or track to look up. */
export function isNamedLine(line: TripTransitLine | undefined): boolean {
  return line?.source === "named";
}
