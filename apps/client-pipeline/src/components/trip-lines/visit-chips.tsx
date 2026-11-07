import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TripVisit } from "@/api/trip-lines";
import { VISIT_ICONS } from "@/components/trip-lines/visit-icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VisitChipsProps {
  visits: TripVisit[];
  /** Moves a visit one photo earlier or later on the route; left out, they can't move. */
  onMove?: (visit: TripVisit, by: -1 | 1) => void;
}

/** The places visited between two photos, as small icons whose name shows on hover; nothing when none. */
export function VisitChips({ visits, onMove }: VisitChipsProps) {
  if (visits.length === 0) return null;
  return (
    <span className="flex flex-col gap-0.5" aria-label="Places visited here">
      {visits.map((v, i) => (
        <VisitChip key={i} visit={v} onMove={onMove && ((by) => onMove(v, by))} />
      ))}
    </span>
  );
}

/** The arrow buttons that move a visit, shown while it's pointed at. */
const ARROW =
  "hover:bg-muted rounded-sm opacity-0 group-hover/visit:opacity-100 focus-visible:opacity-100";

function VisitChip({ visit, onMove }: { visit: TripVisit; onMove?: (by: -1 | 1) => void }) {
  const Icon = VISIT_ICONS[visit.kind];
  const name = visit.name || "Unnamed place";
  return (
    <span className="group/visit flex items-center">
      {onMove && (
        <button
          type="button"
          title="Move a photo earlier"
          className={ARROW}
          onClick={() => onMove(-1)}
        >
          <ChevronLeft className="size-3" aria-hidden />
        </button>
      )}
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
      {onMove && (
        <button
          type="button"
          title="Move a photo later"
          className={ARROW}
          onClick={() => onMove(1)}
        >
          <ChevronRight className="size-3" aria-hidden />
        </button>
      )}
    </span>
  );
}
