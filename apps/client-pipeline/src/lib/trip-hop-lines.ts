import type { TripSegment, TripTransitLine } from "@/api/trip-lines";
import { type Gap, type GapDraft, type Path, segmentKey } from "@/lib/trip-gaps";

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

/** The draft with the hop riding line along path, or riding none (drawn straight) for undefined. */
export function withHopLine(
  draft: GapDraft,
  hop: TripSegment,
  picked?: { line: TripTransitLine; path: Path },
): GapDraft {
  const key = String(hop.photos[0]);
  if (!picked) return { ...draft, lines: without(draft.lines, key) };
  const { line, path } = picked;
  const lines = { ...draft.lines, [key]: { mode: hop.mode as Gap, line } };
  const ridden: TripSegment = { ...hop, line, path: undefined };
  return { ...draft, lines, paths: { ...draft.paths, [segmentKey(ridden)]: path } };
}
