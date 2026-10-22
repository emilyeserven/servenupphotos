import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PhotoLocation as Location } from "@/lib/photos";
import { cn } from "@/lib/utils";

interface PhotoLocationProps {
  location: Location;
  className?: string;
  /** Colors for the GPS position and country shown on hover, to match what's around it. */
  detailsClassName?: string;
}

/**
 * Where a photo was taken, as text that shows its GPS position on hover or focus, with its country
 * under it when the text leaves the country out. Just the text when there's nothing more to show.
 */
export function PhotoLocation({ location, className, detailsClassName }: PhotoLocationProps) {
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
      <TooltipContent className={cn("flex flex-col text-left", detailsClassName)}>
        {location.details.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
