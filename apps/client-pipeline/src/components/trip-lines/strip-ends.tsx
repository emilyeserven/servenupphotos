import { Flag, MapPin } from "lucide-react";
import type { TripPoint, TripVisit } from "@/api/trip-lines";
import { type EndKey, SpotLabel } from "@/components/trip-lines/end-spots";
import { gapInfo } from "@/components/trip-lines/modes";
import { VisitChips } from "@/components/trip-lines/visit-chips";
import { VisitInsert } from "@/components/trip-lines/visit-insert";
import { Button } from "@/components/ui/button";
import { endName } from "@/lib/trip-line-view";
import { cn } from "@/lib/utils";

/** The day's start and end spots with no photo, such as the hotel, and setting them from the strip. */
export interface StripEnds {
  start?: TripPoint;
  end?: TripPoint;
  /** Sets the start or end spot, or removes it with undefined. */
  onSpot: (which: EndKey, spot: TripPoint | undefined) => void;
  /** Starts picking the start or end spot on the map. */
  onPick: (which: EndKey) => void;
  /** The spot the map is waiting to have picked, if any. */
  picking?: EndKey;
}

interface EndChipProps {
  which: EndKey;
  ends: StripEnds;
  /** The trip stops the route starts or ends at, which the chip names when there's no spot. */
  stops: TripVisit[];
  /** The day's trip stops not on the route yet, which can start or end it. */
  choices: TripVisit[];
  /** Puts a trip stop on the route before the first photo, or after the last. */
  onInsert: (visit: TripVisit) => void;
}

/** What each end is called, its icon, and what its menu says about the trip stops listed. */
const END_INFO = {
  start: {
    title: "Start",
    hint: "Where the day starts",
    icon: MapPin,
    heading: "Or a trip stop before the first photo",
  },
  end: {
    title: "End",
    hint: "Where the day ends",
    icon: Flag,
    heading: "Or a trip stop after the last photo",
  },
} as const;

/**
 * Where the day's route starts (before the first photo) or ends (after the last), always shown at
 * that end of the photo strip: the spot with no photo, such as the hotel, or the trip stop it
 * starts or ends at. Its menu picks the spot on the map, labels or removes it, or puts a trip stop
 * there.
 */
export function EndChip({ which, ends, stops, choices, onInsert }: EndChipProps) {
  const spot = ends[which];
  const { title, heading } = END_INFO[which];
  return (
    <figure className="flex w-20 shrink-0 flex-col items-center gap-1">
      <VisitInsert
        choices={choices}
        onInsert={onInsert}
        heading={heading}
        trigger={
          <ChipButton
            which={which}
            name={endName(which, spot, stops)}
            picking={ends.picking === which}
          />
        }
        actions={(close) => (
          <SpotChoice
            spot={spot}
            onSpot={(s) => ends.onSpot(which, s)}
            onPick={() => {
              ends.onPick(which);
              close();
            }}
          />
        )}
      />
      <figcaption className="text-muted-foreground text-xs">{title}</figcaption>
    </figure>
  );
}

interface ChipButtonProps extends React.ComponentProps<"button"> {
  which: EndKey;
  /** What's there: the spot's label or the trip stop's name; none when nothing is. */
  name?: string;
  /** Whether the map is waiting to have this spot picked. */
  picking: boolean;
}

/** The Start or End chip itself, which opens its menu: dashed while nothing is set there. */
function ChipButton({ which, name, picking, className, ...props }: ChipButtonProps) {
  const Icon = END_INFO[which].icon;
  return (
    <button
      type="button"
      title={END_INFO[which].hint}
      className={cn(
        "hover:bg-muted flex size-20 flex-col items-center justify-center gap-1 rounded-md border p-1 text-xs",
        name ? "bg-muted/50" : "text-muted-foreground border-dashed",
        picking && "ring-ring ring-2",
        className,
      )}
      {...props}
    >
      <Icon className="size-4" aria-hidden />
      <span className="line-clamp-2 text-center break-words">{name ?? "Set"}</span>
    </button>
  );
}

interface SpotChoiceProps {
  spot?: TripPoint;
  onSpot: (spot: TripPoint | undefined) => void;
  onPick: () => void;
}

/** The spot with no photo in the chip's menu: its label and removing it, or picking it on the map. */
function SpotChoice({ spot, onSpot, onPick }: SpotChoiceProps) {
  return (
    <div className="flex flex-col gap-1 border-b pb-2">
      <p className="text-muted-foreground px-1 text-xs">A spot with no photo, such as the hotel</p>
      {spot ? (
        <SpotLabel spot={spot} onChange={onSpot} />
      ) : (
        <Button variant="outline" size="sm" className="justify-start" onClick={onPick}>
          <MapPin aria-hidden />
          Pick it on the map
        </Button>
      )}
    </div>
  );
}

interface StripEndProps extends Omit<EndChipProps, "which" | "stops"> {
  /** The trip stops put after the day's last photo, in the order added; the line ends at the last. */
  stops: TripVisit[];
  /** Moves a trip stop one photo earlier or later on the route; left out, they can't move. */
  onMove?: (visit: TripVisit, by: -1 | 1) => void;
  /** Takes a trip stop off the route; left out, they can't be taken off. */
  onOff?: (visit: TripVisit) => void;
}

/**
 * What comes after the day's last photo in the photo strip: the walk to the trip stops the route
 * ends at, such as dinner after the last photo, or to the end spot, then the End chip.
 */
export function StripEnd({ stops, onMove, onOff, ...chip }: StripEndProps) {
  const walks = stops.length > 0 || chip.ends.end !== undefined;
  return (
    <li className="flex shrink-0 items-center gap-1">
      {walks && <WalkToEnd />}
      <VisitChips visits={stops} onMove={onMove} onOff={onOff} />
      <EndChip which="end" stops={stops} {...chip} />
    </li>
  );
}

/** The walk from the last photo on to where the day ends. */
function WalkToEnd() {
  const { icon: Icon, label } = gapInfo("walk");
  return (
    <span
      title={label}
      className="bg-muted flex h-9 w-9 items-center justify-center rounded-md border"
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{label} to the end of the route</span>
    </span>
  );
}
