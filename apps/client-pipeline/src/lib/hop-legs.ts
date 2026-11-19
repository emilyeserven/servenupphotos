import type { TripSegment } from "@/api/trip-lines";
import type { GapDraft, HopLine } from "@/lib/trip-gaps";

/**
 * A hop cut at trip stops, such as a train ride changed at a station on the way, is several
 * stretches (legs), each naming its own line. A leg is known by a key: the ID of the photo the hop
 * starts from for a leg that starts at it, as before hops were cut, and that ID with the leg's
 * number after it ("12+1", "12+2") for each leg after a trip stop. The day's start hop counts from
 * "start".
 */

/** Each segment's leg key, in order. */
export function legKeys(segments: TripSegment[]): string[] {
  let anchor = "start";
  let k = 0;
  return segments.map((s) => {
    if (!s.start && s.photos.length > 0) {
      anchor = String(s.photos[0]);
      k = 0;
      return anchor;
    }
    k += 1;
    return `${anchor}+${k}`;
  });
}

/** A leg's line and stations as its segment lists them, leaving out the stations it doesn't have. */
function rideFields({ line, board, alight, rides }: Omit<HopLine, "mode">): Omit<HopLine, "mode"> {
  return { line, ...(board && { board }), ...(alight && { alight }), ...(rides && { rides }) };
}

/** The segments with the line each leg rode, when one was picked for its mode. */
export function withLegLines(segments: TripSegment[], lines: GapDraft["lines"]): TripSegment[] {
  const keys = legKeys(segments);
  return segments.map((s, i) => {
    const picked = lines?.[keys[i]!];
    return picked?.mode === s.mode ? { ...s, ...rideFields(picked) } : s;
  });
}

/** The lines the segments' legs rode, by leg key. */
export function legLinesOf(segments: TripSegment[]): Record<string, HopLine> {
  const keys = legKeys(segments);
  return Object.fromEntries(
    segments.flatMap((s, i) =>
      s.line
        ? [[keys[i]!, { mode: s.mode as HopLine["mode"], ...rideFields({ ...s, line: s.line }) }]]
        : [],
    ),
  );
}
