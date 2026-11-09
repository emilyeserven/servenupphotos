import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { TripSegment } from "@/api/trip-lines";
import { Button } from "@/components/ui/button";
import type { TripDay } from "@/lib/trip-days";
import type { GapDraft } from "@/lib/trip-gaps";
import { movedVia } from "@/lib/trip-points";
import { movedInRoute, type PlacedVia, viasInRouteOrder } from "@/lib/via-order";

interface ViaListProps {
  day: TripDay;
  draft: GapDraft;
  segments: TripSegment[];
  onChange: (draft: GapDraft) => void;
}

/**
 * The via points in the order the route goes through them, numbered as on the map, each moved one
 * place earlier or later, or removed. Moving one past a photo makes the route bend through it on
 * the other side of that photo.
 */
export function ViaList({ day, draft, segments, onChange }: ViaListProps) {
  const ordered = viasInRouteOrder(draft, segments);
  if (ordered.length === 0) return null;
  const move = (i: number, step: -1 | 1) => onChange(movedInRoute(draft, ordered, i, step));
  return (
    <ol className="flex flex-col gap-1 text-sm" aria-label="Via points">
      {ordered.map((via, i) => (
        <li key={`${via.key}-${via.index}`} className="flex items-center gap-2">
          <ViaNumber n={i + 1} />
          <span className="text-muted-foreground min-w-0 flex-1 truncate">
            {afterWhat(via, day)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move via point ${i + 1} earlier`}
            disabled={i === 0}
            onClick={() => move(i, -1)}
          >
            <ArrowUp aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move via point ${i + 1} later`}
            disabled={i === ordered.length - 1}
            onClick={() => move(i, 1)}
          >
            <ArrowDown aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove via point ${i + 1}`}
            onClick={() => onChange(movedVia(draft, via.key, via.index, null))}
          >
            <X aria-hidden />
          </Button>
        </li>
      ))}
    </ol>
  );
}

/** A via point's number, drawn as on the map: a square "v1", so it isn't mistaken for a photo's dot. */
export function ViaNumber({ n }: { n: number }) {
  return (
    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm border-2 border-dashed border-blue-600 bg-white px-0.5 text-[10px] font-semibold text-blue-700 shadow">
      v{n}
    </span>
  );
}

/** Where the via point is on the route: after which photo, or after the start spot. */
function afterWhat({ key }: PlacedVia, day: TripDay): string {
  if (key === "start") return "After the start spot";
  const n = day.photos.findIndex((p) => String(p.id) === key);
  return n === -1 ? "After a photo no longer on the line" : `After photo ${n + 1}`;
}
