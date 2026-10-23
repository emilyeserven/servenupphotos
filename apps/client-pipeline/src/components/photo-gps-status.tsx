import { CircleAlertIcon, CircleCheckIcon, LocateIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { PhotoPlace, Place } from "@/api/places";
import { gpsSource, gpsText } from "@/lib/place-gps";

interface PhotoGpsStatusProps {
  /** The GPS position in the photo's EXIF, or null when it has none. */
  exifGps: string | null;
  /** The photo's places, in order. */
  rows: PhotoPlace[];
  /** Every place, to find the one whose GPS position the photo falls back to. */
  places: Place[];
}

/**
 * Where the photo goes on the portfolio's map: a checkmark when its EXIF has a GPS position, or else
 * the place whose position it falls back to, or else a warning that it has none.
 */
export function PhotoGpsStatus({ exifGps, rows, places }: PhotoGpsStatusProps) {
  if (exifGps?.trim()) {
    return (
      <Status icon={<CircleCheckIcon className="text-emerald-600 dark:text-emerald-400" />}>
        GPS position from the photo's EXIF: {exifGps}
      </Status>
    );
  }
  const fallback = fallbackPlace(rows, places);
  if (fallback) {
    return (
      <Status icon={<LocateIcon className="text-sky-600 dark:text-sky-400" />}>
        No GPS position in the EXIF, so the map uses {fallback.name}'s fallback position:{" "}
        {gpsText(fallback)}
      </Status>
    );
  }
  return (
    <Status icon={<CircleAlertIcon className="text-amber-600 dark:text-amber-400" />}>
      No GPS position in the EXIF, and none of its places has one, so it isn't on the map. Give one
      of its places a GPS position.
    </Status>
  );
}

/** The first of the photo's places with a GPS position, its own or a place above it's. */
function fallbackPlace(rows: PhotoPlace[], places: Place[]): Place | undefined {
  const byId = new Map(places.map((place) => [place.id, place]));
  for (const row of rows) {
    const place = byId.get(row.id);
    const source = place && gpsSource(place, places);
    if (source) return source;
  }
  return undefined;
}

function Status({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="text-muted-foreground flex items-start gap-1.5 text-xs [&_svg]:mt-px [&_svg]:size-3.5 [&_svg]:shrink-0">
      {icon}
      <span>{children}</span>
    </p>
  );
}
