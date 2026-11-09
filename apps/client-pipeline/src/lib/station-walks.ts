import type { StationWalk, TripPoint, TripSegment } from "@/api/trip-lines";

/** A path, each point [longitude, latitude]. */
type Path = [number, number][];

/** The end of a hop a walk goes to or from: the station it got on at, or got off at. */
export type WalkEnd = "board" | "alight";

/** The draft's via spots and paths, as station walks read them. */
interface WalkDraft {
  via?: Record<string, TripPoint[]>;
  paths?: Record<string, Path>;
}

/** Where a hop's ends keep their walks in a segment. */
const WALK_FIELD = { board: "boardWalk", alight: "alightWalk" } as const;

/** The via list key of the walk to or from a station of the hop from photo a, such as "alight:12". */
export function walkKey(end: WalkEnd, a: number): string {
  return `${end}:${a}`;
}

/** Which walk a via list key is, with the photo its hop starts from; none for any other key. */
export function walkOfKey(key: string): { end: WalkEnd; a: number } | undefined {
  const [end, a] = key.split(":");
  if (end !== "board" && end !== "alight") return undefined;
  return { end, a: Number(a) };
}

/** What makes a station walk's path: its hop's photos, its station, and its via spots. */
function walkPathKey(segment: TripSegment, end: WalkEnd, via: TripPoint[]): string {
  const at = (p?: TripPoint) => (p ? [p.latitude, p.longitude] : null);
  return JSON.stringify(["walk", end, segment.photos, at(segment[end]), via.map(at)]);
}

/** The hop's stations it got on or off at, each with its end. */
function stationEnds(segment: TripSegment): WalkEnd[] {
  if (!segment.line) return [];
  return (["board", "alight"] as const).filter((end) => segment[end]);
}

/** The walk to or from the hop's station as the draft has it; none when it has neither via spots nor path. */
function draftWalk(segment: TripSegment, end: WalkEnd, draft: WalkDraft): StationWalk | undefined {
  const via = draft.via?.[walkKey(end, segment.photos[0]!)] ?? [];
  const path = draft.paths?.[walkPathKey(segment, end, via)];
  if (via.length === 0 && !path) return undefined;
  return { ...(via.length > 0 && { via }), ...(path && { path }) };
}

/** The hop with the walks to and from its stations from the draft, shaped by their via spots. */
export function withStationWalks(segment: TripSegment, draft: WalkDraft): TripSegment {
  const walks = stationEnds(segment).flatMap((end) => {
    const walk = draftWalk(segment, end, draft);
    return walk ? [[WALK_FIELD[end], walk] as const] : [];
  });
  return walks.length > 0 ? { ...segment, ...Object.fromEntries(walks) } : segment;
}

/** The segments' station walks, each with its hop and end. */
function walksOf(segments: TripSegment[]) {
  return segments.flatMap((segment) =>
    stationEnds(segment).flatMap((end) => {
      const walk = segment[WALK_FIELD[end]];
      return walk ? [{ segment, end, walk }] : [];
    }),
  );
}

/** The segments' station walks' via spots, by their via list key. */
export function walkViasOf(segments: TripSegment[]): Record<string, TripPoint[]> {
  const shaped = walksOf(segments).filter(({ walk }) => (walk.via?.length ?? 0) > 0);
  return Object.fromEntries(
    shaped.map(({ segment, end, walk }) => [walkKey(end, segment.photos[0]!), walk.via!]),
  );
}

/** The segments' station walks' paths along streets, by walkPathKey. */
export function walkPathsOf(segments: TripSegment[]): Record<string, Path> {
  const routed = walksOf(segments).filter(({ walk }) => (walk.path?.length ?? 0) >= 2);
  return Object.fromEntries(
    routed.map(({ segment, end, walk }) => [walkPathKey(segment, end, walk.via ?? []), walk.path!]),
  );
}

/** How many of the segments' station walks have no path along streets yet. */
export function unsnappedWalks(segments: TripSegment[]): number {
  return segments
    .flatMap((s) => stationEnds(s).map((end) => s[WALK_FIELD[end]]))
    .filter((walk) => (walk?.path?.length ?? 0) < 2).length;
}

/** The points a station walk goes through from x to y: its path, or else its via spots between them. */
export function walkLine(walk: StationWalk | undefined, x: TripPoint, y: TripPoint): TripPoint[] {
  if (walk?.path && walk.path.length >= 2) {
    return walk.path.map(([longitude, latitude]) => ({ latitude, longitude }));
  }
  return [x, ...(walk?.via ?? []), y];
}
