import { ChevronLeft, ChevronRight, type LucideIcon, X } from "lucide-react";
import type { TripVisit } from "@/api/trip-lines";
import { StopWayIcon } from "@/components/trip-lines/stop-way";
import { VISIT_ICONS } from "@/components/trip-lines/visit-icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VisitChipsProps {
  visits: TripVisit[];
  /** Moves a visit one photo earlier or later on the route; left out, they can't move. */
  onMove?: (visit: TripVisit, by: -1 | 1) => void;
  /** Takes a visit off the route, back to the day's Trip Stops page; left out, it can't be. */
  onOff?: (visit: TripVisit) => void;
}

/** The trip stops between two photos, as small icons whose name shows on hover; nothing when none. */
export function VisitChips({ visits, onMove, onOff }: VisitChipsProps) {
  if (visits.length === 0) return null;
  return (
    <span className="flex items-center gap-0.5" aria-label="Trip stops here">
      {visits.map((v, i) => (
        <VisitChip
          key={i}
          visit={v}
          onMove={onMove && ((by) => onMove(v, by))}
          onOff={onOff && (() => onOff(v))}
        />
      ))}
    </span>
  );
}

/** The buttons over a visit, shown while it's pointed at or one of them has focus. */
const HOVER_BUTTONS =
  "bg-background absolute top-full left-1/2 mt-0.5 z-10 hidden -translate-x-1/2 items-center rounded-sm border shadow-sm group-focus-within/visit:flex group-hover/visit:flex";

interface VisitChipProps {
  visit: TripVisit;
  onMove?: (by: -1 | 1) => void;
  onOff?: () => void;
}

/**
 * One trip stop: its icon, named on hover, with arrows that move it and a cross that takes it off
 * shown above it while it's pointed at, so stops side by side sit close together.
 */
function VisitChip({ visit, onMove, onOff }: VisitChipProps) {
  const Icon = VISIT_ICONS[visit.kind];
  const name = nameOf(visit);
  return (
    <span className="group/visit relative flex items-center gap-0.5">
      <StopWayIcon visit={visit} />
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="flex size-6 items-center justify-center rounded-full border border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="sr-only">{name}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{name}</TooltipContent>
      </Tooltip>
      <ChipButtons onMove={onMove} onOff={onOff} />
    </span>
  );
}

/** The arrows that move a visit and the cross that takes it off; nothing when it can't be changed. */
function ChipButtons({ onMove, onOff }: Pick<VisitChipProps, "onMove" | "onOff">) {
  if (!onMove && !onOff) return null;
  return (
    <span className={HOVER_BUTTONS}>
      <MoveButton by={-1} onMove={onMove} />
      <MoveButton by={1} onMove={onMove} />
      <ChipButton title="Take off the route" icon={X} onClick={onOff} />
    </span>
  );
}

/** Moves the visit a photo earlier (-1) or later (1); nothing when it can't move. */
function MoveButton({ by, onMove }: { by: -1 | 1; onMove?: (by: -1 | 1) => void }) {
  if (!onMove) return null;
  const earlier = by < 0;
  return (
    <ChipButton
      title={earlier ? "Move a photo earlier" : "Move a photo later"}
      icon={earlier ? ChevronLeft : ChevronRight}
      onClick={() => onMove(by)}
    />
  );
}

/** The place's name, or a stand-in while it has none. */
function nameOf(visit: TripVisit): string {
  return visit.name || "Unnamed place";
}

interface ChipButtonProps {
  title: string;
  icon: LucideIcon;
  /** What it does; left out, the button isn't shown. */
  onClick?: () => void;
}

function ChipButton({ title, icon: Icon, onClick }: ChipButtonProps) {
  if (!onClick) return null;
  return (
    <button type="button" title={title} className="hover:bg-muted p-0.5" onClick={onClick}>
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">{title}</span>
    </button>
  );
}
