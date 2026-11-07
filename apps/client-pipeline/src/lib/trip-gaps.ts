import type { TripMode, TripPoint, TripSegment, TripTransitLine, TripVia } from "@/api/trip-lines";

/**
 * What happened between two photos taken one after the other: kept walking, a break (the line
 * stops, and starts again at the next photo), or a hop by train, subway, bus or car.
 */
export type Gap = "walk" | "break" | Exclude<TripMode, "walk">;

/** Where a via spot goes: after the day's start spot ("start"), or after a photo, by its ID. */
export type ViaKey = string;

/** A path along streets, each point [longitude, latitude]. */
export type Path = [number, number][];

/** A day's trip line as the editor holds it: one gap between each two photos, and the day's ends. */
export interface GapDraft {
  gaps: Gap[];
  /** A spot with no photo the day starts from, such as the hotel. */
  start?: TripPoint;
  /** A spot with no photo the day ends at. */
  end?: TripPoint;
  /** The via spots after the start spot and after each photo, in order. */
  via?: Record<ViaKey, TripPoint[]>;
  /** Each segment's path along streets, by segmentKey, kept while the segment is unchanged. */
  paths?: Record<string, Path>;
  /**
   * The line each hop rode, by the ID of the photo it starts from, with the hop's mode then: a hop
   * changed to another mode leaves it out.
   */
  lines?: Record<string, HopLine>;
}

/** The line a hop rode, and how the hop was travelled when it was picked. */
export interface HopLine {
  mode: Gap;
  line: TripTransitLine;
  /** The station it got on at, when not at the photo. */
  board?: TripPoint;
  /** The station it got off at, when not at the next photo. */
  alight?: TripPoint;
}

/** One run of photos walked through, with the spots before, between and after them. */
interface Run {
  start?: TripPoint;
  photos: number[];
  via: TripVia[];
  end?: TripPoint;
}

/** The via spots in the draft after key, as a segment lists them. */
function viaOf(draft: GapDraft, key: ViaKey): TripVia[] {
  const after = key === "start" ? {} : { after: Number(key) };
  return (draft.via?.[key] ?? []).map(({ latitude, longitude }) => ({
    ...after,
    latitude,
    longitude,
  }));
}

/** How many points a run's line goes through. */
function runPoints({ start, photos, via, end }: Run): number {
  return photos.length + via.length + (start ? 1 : 0) + (end ? 1 : 0);
}

/** The run as a walking segment, when it has two or more points to draw. */
function walkSegment(run: Run): TripSegment[] {
  if (runPoints(run) < 2) return [];
  return [{ mode: "walk", photos: run.photos, ...withPoints(run) }];
}

/** The run's start and end spots and via spots, leaving out the ones it doesn't have. */
function withPoints({ start, end, via }: Pick<Run, "start" | "end" | "via">): Partial<TripSegment> {
  return { ...(start && { start }), ...(end && { end }), ...(via.length > 0 && { via }) };
}

/** The first run: the first photo, after the start spot and its via spots when there is one. */
function firstRun(photos: number[], draft: GapDraft): Run {
  const via = draft.start ? viaOf(draft, "start") : [];
  return { start: draft.start, photos: photos.slice(0, 1), via };
}

/** The last run, ending at the end spot with the last photo's via spots when there is one. */
function lastRun(run: Run, draft: GapDraft): Run {
  if (!draft.end) return run;
  return { ...run, end: draft.end, via: [...run.via, ...viaOf(draft, String(run.photos.at(-1)))] };
}

/** A hop's line and stations as its segment lists them, leaving out the stations it doesn't have. */
function rideFields({ line, board, alight }: Omit<HopLine, "mode">): Omit<HopLine, "mode"> {
  return { line, ...(board && { board }), ...(alight && { alight }) };
}

/** The hop from photo a to b, with its via spots, and its line when one was picked for its mode. */
function hopSegment(draft: GapDraft, gap: Exclude<Gap, "walk" | "break">, a: number, b: number) {
  const picked = draft.lines?.[String(a)];
  const line = picked?.mode === gap ? rideFields(picked) : {};
  return { mode: gap, photos: [a, b], ...withPoints({ via: viaOf(draft, String(a)) }), ...line };
}

/** The segments the gaps make between photos, taken one after the other, without their paths. */
function plainSegments(photos: number[], draft: GapDraft): TripSegment[] {
  const segments: TripSegment[] = [];
  let run = firstRun(photos, draft);
  draft.gaps.forEach((gap, i) => {
    const [a, b] = [photos[i] as number, photos[i + 1] as number];
    if (gap === "walk") {
      run.via.push(...viaOf(draft, String(a)));
      run.photos.push(b);
      return;
    }
    segments.push(...walkSegment(run));
    if (gap !== "break") segments.push(hopSegment(draft, gap, a, b));
    run = { photos: [b], via: [] };
  });
  return [...segments, ...walkSegment(lastRun(run, draft))];
}

/** The point's coordinates, or null when there's none. */
function at(p: TripPoint | undefined): [number, number] | null {
  return p ? [p.latitude, p.longitude] : null;
}

/** What makes a segment's path: its mode, points and line, but not its spots' labels. */
export function segmentKey(s: TripSegment): string {
  const via = (s.via ?? []).map((v) => [v.after ?? null, v.latitude, v.longitude]);
  const ride = [s.line?.id ?? null, at(s.board), at(s.alight)];
  return JSON.stringify([s.mode, at(s.start), s.photos, at(s.end), via, ride]);
}

/** The segment with its path from the draft, when it has one. */
function withPath(segment: TripSegment, draft: GapDraft): TripSegment {
  const path = draft.paths?.[segmentKey(segment)];
  return path ? { ...segment, path } : segment;
}

/** The segments the gaps make between photos, taken one after the other. */
export function segmentsOf(photos: number[], draft: GapDraft): TripSegment[] {
  return plainSegments(photos, draft).map((segment) => withPath(segment, draft));
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

/** The segments' via spots, by what they come after. */
function viaByKey(segments: TripSegment[]): Record<ViaKey, TripPoint[]> {
  const out: Record<ViaKey, TripPoint[]> = {};
  for (const { after, latitude, longitude } of segments.flatMap((s) => s.via ?? [])) {
    const key = after === undefined ? "start" : String(after);
    out[key] = [...(out[key] ?? []), { latitude, longitude }];
  }
  return out;
}

/** The segments' paths along streets, by segmentKey. */
export function pathsOf(segments: TripSegment[]): Record<string, Path> {
  const routed = segments.filter((s) => s.path && s.path.length >= 2);
  return Object.fromEntries(routed.map((s) => [segmentKey(s), s.path as Path]));
}

/** The lines the segments' hops rode, by the photo each hop starts from. */
function linesOf(segments: TripSegment[]): Record<string, HopLine> {
  const ridden = segments.filter((s) => s.line && s.photos.length > 0);
  return Object.fromEntries(
    ridden.map((s) => [
      String(s.photos[0]),
      { mode: s.mode as Gap, ...rideFields({ ...s, line: s.line! }) },
    ]),
  );
}

/** A saved trip line's segments as gaps between the photos, taken one after the other. */
export function draftOf(photos: number[], segments: TripSegment[]): GapDraft {
  const gaps = photos.slice(1).map((b, i) => gapIn(segments, photos[i] as number, b));
  const lines = linesOf(segments);
  return { gaps, ...dayEnds(segments), via: viaByKey(segments), paths: pathsOf(segments), lines };
}

/** The draft with every gap kept walking: one line through all the photos. */
export function walkingDraft(photos: number[]): GapDraft {
  return { gaps: photos.slice(1).map(() => "walk") };
}
