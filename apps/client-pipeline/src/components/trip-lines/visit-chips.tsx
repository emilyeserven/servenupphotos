import { ChevronLeft, ChevronRight, type LucideIcon, X } from "lucide-react";
import type { TripVisit } from "@/api/trip-lines";
import { VISIT_ICONS } from "@/components/trip-lines/visit-icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VisitChipsProps {
  visits: TripVisit[];
  /** Moves a visit one photo earlier or later on the route; left out, they can't move. */
  onMove?: (visit: TripVisit, by: -1 | 1) => void;
  /** Takes a visit off the route, back to the day's Places page; left out, it can't be. */
  onOff?: (visit: TripVisit) => void;
}

/** The places visited between two photos, as small icons whose name shows on hover; nothing when none. */
export function VisitChips({ visits, onMove, onOff }: VisitChipsProps) {
  if (visits.length === 0) return null;
  return (
    <span className="flex flex-col gap-0.5" aria-label="Places visited here">
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

/** The buttons beside a visit, shown while it's pointed at. */
const HOVER_BUTTON =
  "hover:bg-muted rounded-sm opacity-0 group-hover/visit:opacity-100 focus-visible:opacity-100";

interface VisitChipProps {
  visit: TripVisit;
  onMove?: (by: -1 | 1) => void;
  onOff?: () => void;
}

/** One place visited: its icon, named on hover, between arrows that move it and a cross that takes it off. */
function VisitChip({ visit, onMove, onOff }: VisitChipProps) {
  const Icon = VISIT_ICONS[visit.kind];
  const name = nameOf(visit);
  return (
    <span className="group/visit flex items-center">
      <ChipButton
        title="Move a photo earlier"
        icon={ChevronLeft}
        onClick={onMove && (() => onMove(-1))}
      />
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
      <ChipButton
        title="Move a photo later"
        icon={ChevronRight}
        onClick={onMove && (() => onMove(1))}
      />
      <ChipButton title="Take off the route" icon={X} onClick={onOff} />
    </span>
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
    <button type="button" title={title} className={HOVER_BUTTON} onClick={onClick}>
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">{title}</span>
    </button>
  );
}
