import type { ReactNode } from "react";
import { useScriptDisplay } from "@/components/script-display-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { LocalizedLocation } from "@/lib/photos";
import { cn } from "@/lib/utils";

interface PhotoLocationProps {
  location: LocalizedLocation;
  className?: string;
  /** Colors for the GPS position and country shown on hover, to match what's around it. */
  detailsClassName?: string;
  /** Which side of the text the details open on, to keep them off what's next to it. */
  side?: "top" | "right";
  /** More to show under the details, such as the photo viewer's View on map link. */
  children?: ReactNode;
}

/**
 * Where a photo was taken, as text that shows its GPS position on hover or focus, with its country
 * under it when the text leaves the country out, written as the menu's Script Display says. Just
 * the text when there's nothing more to show. `children` go under the details; the tooltip stays
 * open while the pointer is over it, so they can be clicked.
 */
export function PhotoLocation({
  location: localized,
  className,
  detailsClassName,
  side,
  children,
}: PhotoLocationProps) {
  const location = localized[useScriptDisplay().script];
  if (location.details.length === 0 && !children)
    return <span className={className}>{location.label}</span>;
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
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
