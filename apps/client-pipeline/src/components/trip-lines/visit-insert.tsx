import { Link } from "@tanstack/react-router";
import { type LucideIcon, MapPinPlus } from "lucide-react";
import { useState } from "react";
import type { TripVisit } from "@/api/trip-lines";
import { VISIT_ICONS } from "@/components/trip-lines/visit-icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface VisitInsertProps {
  /** The day's trip stops not on the route yet, from its Trip Stops page. */
  choices: TripVisit[];
  /** Puts the trip stop on the route here. */
  onInsert: (visit: TripVisit) => void;
  /** What the menu says the stop is put as; between the two photos when left out. */
  heading?: string;
  /** The button's icon; a pin with a plus when left out. */
  icon?: LucideIcon;
  /** What the button says on hover and to screen readers. */
  title?: string;
  /**
   * Other things to do here, listed above the trip stops, such as cutting to a new group; given
   * a way to close the menu.
   */
  actions?: (close: () => void) => React.ReactNode;
  /** What opens the menu, in place of the icon button. */
  trigger?: React.ReactNode;
  className?: string;
}

/**
 * Puts one of the day's trip stops between two photos: the ones added on the day's Trip Stops page
 * and not on the route yet, or a link there when there are none.
 */
export function VisitInsert(props: VisitInsertProps) {
  const { choices, onInsert, heading, actions, trigger } = props;
  const { icon: Icon = MapPinPlus, title = "Put a trip stop here", className } = props;
  const [open, setOpen] = useState(false);
  const insert = (visit: TripVisit) => {
    onInsert(visit);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            title={title}
            className={cn("hover:bg-muted rounded-sm p-0.5", className)}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="sr-only">{title}</span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-64 flex-col gap-1 p-2">
        {actions?.(() => setOpen(false))}
        <p className="text-muted-foreground px-1 text-xs">
          {heading ?? "A trip stop between these photos"}
        </p>
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
        params={(p) => ({ ...p, part: "stops" })}
        search={(s) => s}
        className="text-foreground underline underline-offset-4"
      >
        Add stops on the Trip Stops page
      </Link>
    </p>
  );
}
