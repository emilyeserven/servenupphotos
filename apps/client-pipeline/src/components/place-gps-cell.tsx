import { CircleAlertIcon, LocateFixedIcon, LocateIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Place } from "@/api/places";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { gpsSource, gpsText } from "@/lib/place-gps";

interface PlaceGpsCellProps {
  place: Place;
  places: Place[];
  /** How many photos listing the place can't go on the map, for want of a GPS position. */
  unmapped: number;
}

/** The count with its noun, such as "1 photo" or "3 photos". */
function photosText(count: number): string {
  return `${count} photo${count === 1 ? "" : "s"}`;
}

/**
 * The place's GPS position as an icon: a filled crosshair for its own, a plain one for a place above
 * it's, or a warning when photos given it have no GPS position at all. Hovering says which.
 */
export function PlaceGpsCell({ place, places, unmapped }: PlaceGpsCellProps) {
  const source = gpsSource(place, places);
  if (source === place) {
    return (
      <GpsIcon label={`GPS position ${gpsText(place)}`}>
        <LocateFixedIcon className="text-emerald-600 dark:text-emerald-400" />
      </GpsIcon>
    );
  }
  if (source) {
    return (
      <GpsIcon label={`Uses ${source.name}'s GPS position, ${gpsText(source)}`}>
        <LocateIcon className="text-muted-foreground" />
      </GpsIcon>
    );
  }
  return unmapped > 0 ? <MissingGps photos={unmapped} /> : null;
}

/** The warning that photos given the place have no GPS position, so it should have one. */
function MissingGps({ photos }: { photos: number }) {
  return (
    <GpsIcon
      label={`${photosText(photos)} with this place have no GPS position in their EXIF. Give the place one so they show on the portfolio's map.`}
    >
      <CircleAlertIcon className="text-amber-600 dark:text-amber-400" />
    </GpsIcon>
  );
}

/** An icon that says what it means in a tooltip, and to screen readers. */
function GpsIcon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          tabIndex={0}
          aria-label={label}
          className="focus-visible:ring-ring/50 inline-flex rounded-full outline-none focus-visible:ring-[3px] [&_svg]:size-4"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
