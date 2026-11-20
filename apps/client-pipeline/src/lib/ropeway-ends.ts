import type { TripPoint, TripSegment, TripTransitLine } from "@/api/trip-lines";
import { legKeys } from "@/lib/hop-legs";
import type { GapDraft } from "@/lib/trip-gaps";
import { withHopLine, withNamedLine } from "@/lib/trip-hop-lines";

/**
 * A ropeway's start or end station being picked on the map, with the leg key (`legKeys`) of its hop,
 * such as "ropeway-start:12".
 */
export type RopewayPick = `${"ropeway-start" | "ropeway-end"}:${string}`;

/** Which station of a ropeway: the one it starts from (got on at) or the one it ends at (got off at). */
export type RopewaySide = "start" | "end";

/** The pick for the side's station of the ropeway hop with leg key `key`. */
export function ropewayPick(side: RopewaySide, key: string): RopewayPick {
  return `ropeway-${side}:${key}`;
}

/** Whether what the map is waiting to have picked is a ropeway's start or end station. */
export function isRopewayPick(pick: string | undefined): pick is RopewayPick {
  return pick?.startsWith("ropeway-start:") === true || pick?.startsWith("ropeway-end:") === true;
}

/** The side and the leg key `pick` names. */
function parts(pick: RopewayPick): [RopewaySide, string] {
  const at = pick.indexOf(":");
  return [pick.slice("ropeway-".length, at) as RopewaySide, pick.slice(at + 1)];
}

/** A spot with an exact place on the map: a photo or a spot with no photo. */
interface Located {
  latitude: number;
  longitude: number;
}

/** A photo with its spot, by ID. */
type Spots = Map<number, Located>;

/** Whether the hop is a ropeway named by hand, so its stations can be placed on the map. */
export function isRopeway(hop: TripSegment): hop is TripSegment & { line: TripTransitLine } {
  return hop.mode === "ropeway" && hop.line?.source === "named";
}

/** The hop's two ends: its start spot or first photo, and its end spot or last photo. */
function hopEnds(hop: TripSegment, spots: Spots): [Located | undefined, Located | undefined] {
  return [hop.start ?? spots.get(hop.photos[0]!), hop.end ?? spots.get(hop.photos.at(-1)!)];
}

/** A spot as [longitude, latitude]. */
function spot(p: Located): [number, number] {
  return [p.longitude, p.latitude];
}

/** A ropeway's name and the stations it ran between, each left out where it's at the photo. */
export interface RopewayRide {
  line: TripTransitLine;
  board?: TripPoint;
  alight?: TripPoint;
}

/**
 * The draft with the ropeway hop known by key running between its stations: a straight line from
 * where it got on (its first photo when no station is set) to where it got off, with a walk from the
 * photo to each station set. With neither set, it's just named, drawn straight between its photos.
 */
export function withRopeway(
  draft: GapDraft,
  hop: TripSegment,
  key: string,
  spots: Spots,
  { line, board, alight }: RopewayRide,
): GapDraft {
  const plain: TripSegment = { ...hop, board: undefined, alight: undefined, path: undefined };
  if (!board && !alight) return withNamedLine(draft, plain, key, line.name);
  const [a, b] = hopEnds(hop, spots);
  const from = board ?? a;
  const to = alight ?? b;
  if (!from || !to) return draft;
  const ride = {
    line,
    path: [spot(from), spot(to)],
    ...(board && { board }),
    ...(alight && { alight }),
  };
  return withHopLine(draft, plain, key, ride);
}

/** What each side's station is called until it's named. */
const DEFAULT_LABELS: Record<RopewaySide, string> = { start: "Start station", end: "End station" };

/**
 * The draft with the station `pick` names (a side of a ropeway hop among segments) at point, keeping
 * any name it had, or back at the photo for undefined. The draft as it was when no such hop is drawn.
 */
export function withRopewayEnd(
  draft: GapDraft,
  segments: TripSegment[],
  spots: Spots,
  pick: RopewayPick,
  point: TripPoint | undefined,
): GapDraft {
  const [side, key] = parts(pick);
  const keys = legKeys(segments);
  const hop = segments.find((s, i) => keys[i] === key && isRopeway(s));
  if (!hop || !isRopeway(hop)) return draft;
  const field = side === "start" ? "board" : "alight";
  const label = hop[field]?.label ?? DEFAULT_LABELS[side];
  const station = point && { latitude: point.latitude, longitude: point.longitude, label };
  const stations = { line: hop.line, board: hop.board, alight: hop.alight, [field]: station };
  return withRopeway(draft, hop, key, spots, stations);
}
