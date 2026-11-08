import type { TripLine } from "@/api/trip-lines";
import type { EditorView } from "@/components/trip-lines/editor-actions";

/** A line's trip stops and areas, as the line file lists them: each left out when there are none. */
export type KeptStops = Pick<TripLine, "visits" | "fences">;

/** The trip stops and areas of a line, leaving out empty lists; none without a line. */
export function lineStops(line: Partial<KeptStops> | undefined): KeptStops {
  const { visits = [], fences = [] } = line ?? {};
  return { ...(visits.length > 0 && { visits }), ...(fences.length > 0 && { fences }) };
}

/**
 * The trip stops and areas to keep when the line changes kind: the hand-drawn draft's, or else the
 * saved line's, so turning the automatic line on or off, or removing the route, never loses them.
 */
export function keptStops(view: EditorView, saved: TripLine | undefined): KeptStops {
  return lineStops(view.kind === "hand" ? view.draft : saved);
}

/** Whether there are trip stops or areas to keep. */
export function hasStops(stops: KeptStops): boolean {
  return stops.visits !== undefined || stops.fences !== undefined;
}
