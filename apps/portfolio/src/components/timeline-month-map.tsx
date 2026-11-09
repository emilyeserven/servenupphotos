import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ChevronDown, Route } from "lucide-react";
import { useId, useState } from "react";
import { SketchDrawing } from "@/components/sketch-drawing";
import { type DaysSketch, useDaysSketches } from "@/components/timeline-route-sketch";
import { Button } from "@/components/ui/button";
import { fitView } from "@/lib/fit-view";
import type { Photo } from "@/lib/photos";
import { MONTH_SKETCH_SIZE } from "@/lib/route-sketch";
import { cn } from "@/lib/utils";

/** The days the photos were taken, as TRIPLINES.geo.json writes them, earliest first. */
function daysOf(photos: Photo[]): string[] {
  return [...new Set(photos.map((p) => format(p.takenAt, "yyyy-MM-dd")))].toSorted();
}

/** The days' dates, such as "Oct 1" or "Oct 1–3". */
function daysText(days: string[]): string {
  const [first = "", last = first] = [days[0], days.at(-1)];
  const from = format(parseISO(first), "MMM d");
  return first === last ? from : `${from}–${format(parseISO(last), "d")}`;
}

/** A month's trip line maps on the Timeline, and whether its **Trip lines** button has them open. */
interface MonthTripLines {
  /** One small map for each place the month's lines are in; none for a month without a trip line. */
  places: DaysSketch[];
  open: boolean;
  toggle: () => void;
  /** The id of the maps' list, which the button controls. */
  id: string;
}

/**
 * A month's trip line maps and whether they're open. They start as the display option says, and
 * changing the option opens or closes every month's again.
 */
export function useMonthTripLines(monthPhotos: Photo[], option: boolean): MonthTripLines {
  const places = useDaysSketches(daysOf(monthPhotos), MONTH_SKETCH_SIZE);
  const [state, setState] = useState({ option, open: option });
  const open = state.option === option ? state.open : option;
  const id = useId();
  return { places, open, toggle: () => setState({ option, open: !open }), id };
}

/**
 * The **Trip lines** button at the right of a month's heading, which opens and closes its maps;
 * nothing for a month without a trip line.
 */
export function TripLinesButton({ lines }: { lines: MonthTripLines }) {
  if (lines.places.length === 0) return null;
  return (
    <Button
      type="button"
      variant="outline"
      aria-expanded={lines.open}
      aria-controls={lines.id}
      onClick={lines.toggle}
      className="h-7 gap-1.5 px-2 text-xs has-[>svg]:px-2"
    >
      <Route className="size-3.5" aria-hidden />
      Trip lines
      <ChevronDown
        className={cn("size-3.5 transition-transform", !lines.open && "-rotate-90")}
        aria-hidden
      />
    </Button>
  );
}

/**
 * A month's trip line maps under its heading, each place's lines drawn together in the Map's line
 * styles; nothing while its **Trip lines** button has them closed.
 */
export function MonthMaps({ lines }: { lines: MonthTripLines }) {
  if (!lines.open || lines.places.length === 0) return null;
  return (
    <ul id={lines.id} aria-label="This month's trip lines" className="flex flex-wrap gap-2">
      {lines.places.map((place) => (
        <li key={place.days.join(" ")}>
          <PlaceMap place={place} />
        </li>
      ))}
    </ul>
  );
}

/** One place's small map, with its days, linking to the Map on those days zoomed to fit them. */
function PlaceMap({ place: { days, sketch } }: { place: DaysSketch }) {
  const dates = daysText(days);
  return (
    <Link
      to="/map"
      search={{
        start: days[0],
        end: days.at(-1),
        ...fitView(sketch.bounds, window.innerWidth, window.innerHeight),
      }}
      aria-label={`Show the trip lines of ${dates} on the map`}
      className="group flex flex-col gap-1 rounded-md bg-muted/60 p-1.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <SketchDrawing sketch={sketch} size={MONTH_SKETCH_SIZE} />
      <span className="px-0.5 text-xs text-muted-foreground tabular-nums group-hover:text-foreground">
        {dates}
      </span>
    </Link>
  );
}
