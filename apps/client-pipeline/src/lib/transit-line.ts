import type { TripTransitLine } from "@/api/trip-lines";

/** The line as a hop or leg keeps it: no kind or ends, and where it was found when not OpenStreetMap. */
export function lineOf({ id, name, ref, colour, source }: TripTransitLine): TripTransitLine {
  return { id, name, ...(ref && { ref }), ...(colour && { colour }), ...(source && { source }) };
}
