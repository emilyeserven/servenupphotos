import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { photosInFlightQuery, publishedPhotosQuery } from "@/api/photos";
import { type TripLine, tripLines } from "@/api/trip-lines";
import { comparePhotos } from "@/lib/compare-groups";
import { type DayPhoto, datedPhotos } from "@/lib/timezone-shift-plan";
import { useCombinedData } from "@/stores/combined-data";
import { useLocalEditsStore } from "@/stores/local-edits";

/** No trip lines, while the combined lists are read. */
const NO_LINES = new Map<string, TripLine>();

/**
 * Every photo with a date, from Photos in Flight and the Gallery with their local edits made, and
 * the trip lines as the next Commit will have them. `pending` is true until both photo lists are read.
 */
export function useDatedPhotos(): {
  photos: DayPhoto[];
  lines: Map<string, TripLine>;
  pending: boolean;
} {
  const published = useQuery(publishedPhotosQuery);
  const inFlight = useQuery(photosInFlightQuery);
  const edits = useLocalEditsStore((s) => s.edits);
  const combined = useCombinedData();
  const photos = useMemo(
    () => datedPhotos(comparePhotos(published.data, inFlight.data, edits)),
    [published.data, inFlight.data, edits],
  );
  const lines = useMemo(
    () => (combined.data ? tripLines(combined.data) : NO_LINES),
    [combined.data],
  );
  return { photos, lines, pending: published.isPending || inFlight.isPending };
}
