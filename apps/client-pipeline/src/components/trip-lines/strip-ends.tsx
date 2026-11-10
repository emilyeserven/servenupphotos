import type { TripVisit } from "@/api/trip-lines";
import { gapInfo } from "@/components/trip-lines/modes";
import { VisitChips } from "@/components/trip-lines/visit-chips";
import { VisitInsert } from "@/components/trip-lines/visit-insert";

interface StripEndProps {
  /** The trip stops put after the day's last photo, in the order added; the line ends at the last. */
  stops: TripVisit[];
  /** The day's trip stops not on the route yet, which can end the route. */
  choices: TripVisit[];
  /** Puts a trip stop on the route after the last photo. */
  onInsert: (visit: TripVisit) => void;
  /** Moves a trip stop one photo earlier or later on the route; left out, they can't move. */
  onMove?: (visit: TripVisit, by: -1 | 1) => void;
  /** Takes a trip stop off the route; left out, they can't be taken off. */
  onOff?: (visit: TripVisit) => void;
}

/**
 * What comes after the day's last photo in the photo strip: the walk to the trip stops the route
 * ends at, such as dinner after the last photo, and adding one there, shown on hover.
 */
export function StripEnd({ stops, choices, onInsert, onMove, onOff }: StripEndProps) {
  return (
    <li className="group/end flex shrink-0 items-center gap-1">
      <StopsAtEnd stops={stops} onMove={onMove} onOff={onOff} />
      <VisitInsert
        choices={choices}
        onInsert={onInsert}
        heading="A trip stop the route ends at, after the last photo"
        className="opacity-0 group-hover/end:opacity-100 focus-visible:opacity-100"
      />
    </li>
  );
}

/** The walk from the last photo to the trip stops after it, and their icons; nothing when none. */
function StopsAtEnd({ stops, onMove, onOff }: Omit<StripEndProps, "choices" | "onInsert">) {
  if (stops.length === 0) return null;
  const { icon: Icon, label } = gapInfo("walk");
  return (
    <>
      <span
        title={label}
        className="bg-muted flex h-9 w-9 items-center justify-center rounded-md border"
      >
        <Icon className="size-4" aria-hidden />
        <span className="sr-only">{label} to the end of the route</span>
      </span>
      <VisitChips visits={stops} onMove={onMove} onOff={onOff} />
    </>
  );
}

interface StartInsertProps {
  /** The day's trip stops not on the route yet, which can start it. */
  choices: TripVisit[];
  /** Puts a trip stop on the route before the first photo. */
  onInsert: (visit: TripVisit) => void;
}

/**
 * Puts a trip stop on the route before the day's first photo, such as lunch before the first photo
 * was taken: after the start spot when the day has one, or else the line starts there. Shown on
 * hover, before the first photo in the photo strip.
 */
export function StartInsert({ choices, onInsert }: StartInsertProps) {
  return (
    <span className="group/start flex h-20 items-center">
      <VisitInsert
        choices={choices}
        onInsert={onInsert}
        heading="A trip stop the route starts at, before the first photo"
        className="opacity-0 group-hover/start:opacity-100 focus-visible:opacity-100"
      />
    </span>
  );
}
