import type { TripLine, TripSegment, TripVisit } from "@/api/trip-lines";
import type { EditorView } from "@/components/trip-lines/editor-actions";
import type { GapDraft } from "@/lib/trip-gaps";

/** A line's trip stops and areas, as the line file lists them: each left out when there are none. */
export type KeptStops = Pick<TripLine, "visits" | "fences">;

/** The trip stops and areas of a line, leaving out empty lists; none without a line. */
export function lineStops(line: Partial<KeptStops> | undefined): KeptStops {
  const { visits = [], fences = [] } = line ?? {};
  return { ...(visits.length > 0 && { visits }), ...(fences.length > 0 && { fences }) };
}

/**
 * The trip stops and areas to keep when the line changes kind: the hand-drawn draft's, the ones
 * changed on the automatic line and not saved yet, or else the saved line's, so turning the
 * automatic line on or off, or removing the route, never loses them.
 */
export function keptStops(view: EditorView, saved: TripLine | undefined): KeptStops {
  if (view.kind === "hand") return lineStops(view.draft);
  return view.kind === "auto" && view.stops ? view.stops : lineStops(saved);
}

/** Whether there are trip stops or areas to keep. */
export function hasStops(stops: KeptStops): boolean {
  return stops.visits !== undefined || stops.fences !== undefined;
}

/** The draft without its trip stops and areas, as text to compare. */
function routeOnly({ visits: _visits, fences: _fences, ...route }: GapDraft): string {
  return JSON.stringify(route);
}

/** Whether next changes only the trip stops or areas of was, leaving the route as it is. */
export function onlyStopsChanged(was: GapDraft, next: GapDraft): boolean {
  return routeOnly(was) === routeOnly(next);
}

/**
 * The automatic line's segments passing through each trip stop put after a photo a walk goes on
 * from, the way the backend draws it (`withStopVias`); a stop after a walk's last photo, or on a
 * hop or drive, stays a pin.
 */
export function withStopVias(segments: TripSegment[], visits: TripVisit[] = []): TripSegment[] {
  return segments.map((seg) => {
    const via = visits.flatMap((v, visit) => (walksOnFrom(seg, v.after) ? [viaOf(v, visit)] : []));
    return via.length > 0 ? { ...seg, via: [...(seg.via ?? []), ...via] } : seg;
  });
}

/** Whether seg is a walk that goes on from photo id to another photo. */
function walksOnFrom(seg: TripSegment, id: number | undefined): boolean {
  const at = id === undefined ? -1 : seg.photos.indexOf(id);
  return seg.mode === "walk" && at >= 0 && at < seg.photos.length - 1;
}

/** The trip stop at index visit as a via spot that stands for it. */
function viaOf({ after, latitude, longitude }: TripVisit, visit: number) {
  return { after, latitude, longitude, visit };
}
