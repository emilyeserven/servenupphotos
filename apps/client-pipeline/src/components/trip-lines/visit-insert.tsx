import { MapPinPlus } from "lucide-react";
import { useState } from "react";
import type { TripVisit } from "@/api/trip-lines";
import { useSavedPlaces } from "@/components/trip-lines/visits";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TripPhoto } from "@/lib/trip-days";
import { midway, newVisit, placesNear, placeVisit } from "@/lib/trip-visits";
import { cn } from "@/lib/utils";

interface VisitInsertProps {
  /** The photos the gap is between. */
  a: TripPhoto;
  b: TripPhoto;
  /** Adds the place visited to the route right after `a`. */
  onInsert: (visit: TripVisit) => void;
  className?: string;
}

/**
 * Adds a place visited between two photos: one of the saved places near them, or a new one halfway
 * between them to name and move under the map.
 */
export function VisitInsert({ a, b, onInsert, className }: VisitInsertProps) {
  const [open, setOpen] = useState(false);
  const near = placesNear(useSavedPlaces(), [a, b]).slice(0, 8);
  const insert = (visit: TripVisit) => {
    onInsert(visit);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Add a place visited here"
          className={cn("hover:bg-muted rounded-sm p-0.5", className)}
        >
          <MapPinPlus className="size-3.5" aria-hidden />
          <span className="sr-only">Add a place visited here</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-64 flex-col gap-1 p-2">
        <p className="text-muted-foreground px-1 text-xs">A place visited between these photos</p>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => insert(newVisit(midway(a, b)))}
        >
          New place, halfway between
        </Button>
        {near.map((place) => (
          <Button
            key={place.id}
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => insert(placeVisit(place))}
          >
            {place.name}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
