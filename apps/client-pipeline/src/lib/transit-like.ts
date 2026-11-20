import type { TransitLike, TripMode, TripSegment } from "@/api/trip-lines";
import { legKeys } from "@/lib/hop-legs";
import type { GapDraft } from "@/lib/trip-gaps";

/**
 * A `transit` hop (one whose kind isn't known) can borrow the way another mode is routed and drawn,
 * such as a car's along the roads, for a hop no rail or bus map has. Like a hop's line, the choice
 * is kept in the draft by the leg's key (`lib/hop-legs.ts`).
 */

/** Whether the segment's line is a found line's track, which a borrowed mode doesn't replace. */
function ridesFoundLine(segment: TripSegment): boolean {
  return segment.line !== undefined && segment.line.source !== "named";
}

/**
 * The mode the segment is routed and drawn as: the one a transit hop borrows, unless it rides a
 * line found in a source, and else its own.
 */
export function wayOf(segment: TripSegment): TripMode {
  if (segment.mode !== "transit" || !segment.like || ridesFoundLine(segment)) return segment.mode;
  return segment.like;
}

/** The segments with the mode each transit leg borrows, when one was picked. */
export function withLegLikes(segments: TripSegment[], likes: GapDraft["likes"]): TripSegment[] {
  const keys = legKeys(segments);
  return segments.map((s, i) => {
    const like = likes?.[keys[i]!];
    return like && s.mode === "transit" ? { ...s, like } : s;
  });
}

/** The modes the segments' transit legs borrow, by leg key. */
export function legLikesOf(segments: TripSegment[]): Record<string, TransitLike> {
  const keys = legKeys(segments);
  return Object.fromEntries(
    segments.flatMap((s, i) => (s.mode === "transit" && s.like ? [[keys[i]!, s.like]] : [])),
  );
}

/** The draft with the transit leg known by key borrowing like, or drawn as transit for undefined. */
export function withLegLike(draft: GapDraft, key: string, like?: TransitLike): GapDraft {
  const { [key]: _was, ...rest } = draft.likes ?? {};
  return { ...draft, likes: like ? { ...rest, [key]: like } : rest };
}
