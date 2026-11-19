import type { TripPoint, TripSegment } from "@/api/trip-lines";
import type { Gap, GapDraft } from "@/lib/trip-gaps";

/**
 * Which end of a break a spot is, and the photo it's beside: "break-end:12" is where the line before
 * the break ends, after photo 12, and "break-start:13" where the line after it starts, before photo 13.
 */
export type BreakPick = `${"break-end" | "break-start"}:${string}`;

/** Where each kind of break end is kept in the draft. */
const FIELD = { "break-end": "breakEnds", "break-start": "breakStarts" } as const;

/** The kind of break end and the photo ID `pick` names. */
function parts(pick: BreakPick): [keyof typeof FIELD, string] {
  const at = pick.indexOf(":");
  return [pick.slice(0, at) as keyof typeof FIELD, pick.slice(at + 1)];
}

/** The draft with the break end `pick` names set to point, or removed when there's none. */
export function withBreakEnd(
  draft: GapDraft,
  pick: BreakPick,
  point: TripPoint | undefined,
): GapDraft {
  const [kind, id] = parts(pick);
  const { [id]: _old, ...rest } = draft[FIELD[kind]] ?? {};
  return { ...draft, [FIELD[kind]]: point ? { ...rest, [id]: point } : rest };
}

/** The spot the draft has for the break end `pick` names, if it's set. */
export function breakEndOf(draft: GapDraft, pick: BreakPick): TripPoint | undefined {
  const [kind, id] = parts(pick);
  return draft[FIELD[kind]]?.[id];
}

/** Whether what the map is waiting to have picked is the end or start of a line at a break. */
export function isBreakPick(pick: string | undefined): pick is BreakPick {
  return pick?.startsWith("break-end:") === true || pick?.startsWith("break-start:") === true;
}

/**
 * Where the line before the break between photos a and b ends, and where the line after it starts,
 * when the break's spots are set; none for any other gap.
 */
export function breakSpots(
  draft: GapDraft,
  gap: Gap,
  [a, b]: [number, number],
): { end?: TripPoint; start?: TripPoint } {
  if (gap !== "break") return {};
  return { end: draft.breakEnds?.[String(a)], start: draft.breakStarts?.[String(b)] };
}

/**
 * The spots each break in a saved line ends and starts at: the end of the segment its first photo
 * ends, and the start of the one its second photo starts.
 */
export function breakEndsOf(
  photos: number[],
  gaps: Gap[],
  segments: TripSegment[],
): Pick<GapDraft, "breakEnds" | "breakStarts"> {
  const breakEnds: Record<string, TripPoint> = {};
  const breakStarts: Record<string, TripPoint> = {};
  gaps.forEach((gap, i) => {
    if (gap !== "break") return;
    const [a, b] = [photos[i] as number, photos[i + 1] as number];
    const end = segments.find((s) => s.photos.at(-1) === a && s.end)?.end;
    const start = segments.find((s) => s.photos[0] === b && s.start)?.start;
    if (end) breakEnds[String(a)] = end;
    if (start) breakStarts[String(b)] = start;
  });
  return {
    ...(Object.keys(breakEnds).length > 0 && { breakEnds }),
    ...(Object.keys(breakStarts).length > 0 && { breakStarts }),
  };
}
