import { useScriptDisplay } from "@/components/script-display-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type LocationDetail, locationDetails, locationText } from "@/lib/location-detail";
import type { LocalizedLocation, PhotoLocation as Location } from "@/lib/photos";
import { cn } from "@/lib/utils";

interface PhotoLocationProps {
  location: LocalizedLocation;
  className?: string;
  /** Colors for the GPS position and country shown on hover, to match what's around it. */
  detailsClassName?: string;
  /** Which side of the text the details open on, to keep them off what's next to it. */
  side?: "top" | "right";
  /** How much of the location to show, as the Table's View menu picks; its usual text when left out. */
  detail?: LocationDetail;
}

/** The location's text and the lines shown on hover, with as much as `detail` asks for. */
function shownLocation(location: Location, detail?: LocationDetail) {
  if (!detail) return location;
  return { label: locationText(location, detail), details: locationDetails(location, detail) };
}

/**
 * Where a photo was taken, as text that shows its GPS position on hover or focus, with its country
 * under it when the text leaves the country out, written as the menu's Script Display says. Just
 * the text when there's nothing more to show.
 */
export function PhotoLocation({
  location: localized,
  className,
  detailsClassName,
  side,
  detail,
}: PhotoLocationProps) {
  const location = shownLocation(localized[useScriptDisplay().script], detail);
  if (location.details.length === 0) return <span className={className}>{location.label}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "cursor-help underline decoration-current/40 decoration-dotted underline-offset-4 outline-none focus-visible:decoration-current",
            className,
          )}
        >
          {location.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className={cn("flex flex-col text-left", detailsClassName)}>
        {location.details.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
