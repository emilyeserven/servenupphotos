import type { TripSegment } from "@/api/trip-lines";
import type { Ride } from "@/lib/transit-ride";
import { type Gap, type GapDraft, segmentKey } from "@/lib/trip-gaps";

/** The modes whose hops can name the line they rode. */
const LINE_MODES = new Set(["train", "subway", "bus", "transit"]);

/** Whether the segment is a hop that can name the line it rode. */
export function ridesLine(segment: TripSegment): boolean {
  return LINE_MODES.has(segment.mode) && segment.photos.length === 2;
}

/** The draft's lines without the one for the hop starting at key. */
function without(lines: GapDraft["lines"], key: string): GapDraft["lines"] {
  return Object.fromEntries(Object.entries(lines ?? {}).filter(([k]) => k !== key));
}

/** The draft with the hop on the ride, or riding no line (drawn straight) for undefined. */
export function withHopLine(draft: GapDraft, hop: TripSegment, ride?: Ride): GapDraft {
  const key = String(hop.photos[0]);
  if (!ride) return { ...draft, lines: without(draft.lines, key) };
  const { path, ...picked } = ride;
  const lines = { ...draft.lines, [key]: { mode: hop.mode as Gap, ...picked } };
  const ridden: TripSegment = { ...hop, ...picked, path: undefined };
  return { ...draft, lines, paths: { ...draft.paths, [segmentKey(ridden)]: path } };
}
