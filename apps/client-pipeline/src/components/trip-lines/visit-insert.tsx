import { Link } from "@tanstack/react-router";
import { MapPinPlus } from "lucide-react";
import { useState } from "react";
import type { TripVisit } from "@/api/trip-lines";
import { VISIT_ICONS } from "@/components/trip-lines/visit-icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface VisitInsertProps {
  /** The day's places visited not on the route yet, from its Places page. */
  choices: TripVisit[];
  /** Puts the place visited on the route here. */
  onInsert: (visit: TripVisit) => void;
  className?: string;
}

/**
 * Puts one of the day's places visited between two photos: the ones added on the day's Places page
 * and not on the route yet, or a link there when there are none.
 */
export function VisitInsert({ choices, onInsert, className }: VisitInsertProps) {
  const [open, setOpen] = useState(false);
  const insert = (visit: TripVisit) => {
    onInsert(visit);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Put a place visited here"
          className={cn("hover:bg-muted rounded-sm p-0.5", className)}
        >
          <MapPinPlus className="size-3.5" aria-hidden />
          <span className="sr-only">Put a place visited here</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-64 flex-col gap-1 p-2">
        <p className="text-muted-foreground px-1 text-xs">A place visited between these photos</p>
        {choices.map((visit, i) => (
          <Choice key={i} visit={visit} onPick={() => insert(visit)} />
        ))}
        <PlacesLink none={choices.length === 0} />
      </PopoverContent>
    </Popover>
  );
}

/** One place not on the route yet, with its kind's icon. */
function Choice({ visit, onPick }: { visit: TripVisit; onPick: () => void }) {
  const Icon = VISIT_ICONS[visit.kind];
  return (
    <Button variant="ghost" size="sm" className="justify-start" onClick={onPick}>
      <Icon aria-hidden />
      {visit.name || "Unnamed place"}
    </Button>
  );
}

/** Where the day's places are added, saying so when none are left to put here. */
function PlacesLink({ none }: { none: boolean }) {
  return (
    <p className="text-muted-foreground px-1 text-xs">
      {none && "Every place is on the route, or there are none yet. "}
      <Link
        from="/trip-lines/$day/$part"
        to="/trip-lines/$day/$part"
        params={(p) => ({ ...p, part: "places" })}
        search={(s) => s}
        className="text-foreground underline underline-offset-4"
      >
        Add places on the Places page
      </Link>
    </p>
  );
}
