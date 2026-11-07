import type { TripMode, TripPoint, TripSegment } from "@/api/trip-lines";

/**
 * What happened between two photos taken one after the other: kept walking, a break (the line
 * stops, and starts again at the next photo), or a hop by train, subway, bus or car.
 */
export type Gap = "walk" | "break" | Exclude<TripMode, "walk">;

/** A day's trip line as the editor holds it: one gap between each two photos, and the day's ends. */
export interface GapDraft {
  gaps: Gap[];
  /** A spot with no photo the day starts from, such as the hotel. */
  start?: TripPoint;
  /** A spot with no photo the day ends at. */
  end?: TripPoint;
}

/** One run of photos walked through, with the spots before and after it. */
interface Run {
  start?: TripPoint;
  photos: number[];
  end?: TripPoint;
}

/** How many points a run's line goes through. */
function runPoints({ start, photos, end }: Run): number {
  return photos.length + (start ? 1 : 0) + (end ? 1 : 0);
}

/** The run as a walking segment, when it has two or more points to draw. */
function walkSegment(run: Run): TripSegment[] {
  if (runPoints(run) < 2) return [];
  return [{ mode: "walk", photos: run.photos, ...withPoints(run) }];
}

/** The run's start and end spots, leaving out the ones it doesn't have. */
function withPoints({ start, end }: Run): Partial<TripSegment> {
  return { ...(start && { start }), ...(end && { end }) };
}

/** The segments the gaps make between photos, taken one after the other. */
export function segmentsOf(photos: number[], draft: GapDraft): TripSegment[] {
  const segments: TripSegment[] = [];
  let run: Run = { start: draft.start, photos: photos.slice(0, 1) };
  draft.gaps.forEach((gap, i) => {
    const [a, b] = [photos[i] as number, photos[i + 1] as number];
    if (gap === "walk") return run.photos.push(b);
    segments.push(...walkSegment(run));
    if (gap !== "break") segments.push({ mode: gap, photos: [a, b] });
    run = { photos: [b] };
  });
  return [...segments, ...walkSegment({ ...run, end: draft.end })];
}

/** Whether a and b are next to each other, in that order, in the segment's photos. */
function joins(segment: TripSegment, a: number, b: number): boolean {
  const i = segment.photos.indexOf(a);
  return i !== -1 && segment.photos[i + 1] === b;
}

/** The gap between photos a and b in the saved segments: their segment's mode, or a break. */
function gapIn(segments: TripSegment[], a: number, b: number): Gap {
  const segment = segments.find((s) => joins(s, a, b));
  return segment ? (segment.mode as Gap) : "break";
}

/** The day's spots with no photo: the first segment's start and the last one's end. */
function dayEnds(segments: TripSegment[]): Pick<GapDraft, "start" | "end"> {
  return { start: segments[0]?.start, end: segments.at(-1)?.end };
}

/** A saved trip line's segments as gaps between the photos, taken one after the other. */
export function draftOf(photos: number[], segments: TripSegment[]): GapDraft {
  const gaps = photos.slice(1).map((b, i) => gapIn(segments, photos[i] as number, b));
  return { gaps, ...dayEnds(segments) };
}

/** The draft with every gap kept walking: one line through all the photos. */
export function walkingDraft(photos: number[]): GapDraft {
  return { gaps: photos.slice(1).map(() => "walk") };
}
