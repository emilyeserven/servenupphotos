import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { TripSegment } from "@/api/trip-lines";
import { Button } from "@/components/ui/button";
import type { TripDay } from "@/lib/trip-days";
import type { GapDraft } from "@/lib/trip-gaps";
import { movedVia } from "@/lib/trip-points";
import { type WalkEnd, walkOfKey } from "@/lib/station-walks";
import { canMove, movedInRoute, type PlacedVia, viasInRouteOrder } from "@/lib/via-order";

interface ViaListProps {
  day: TripDay;
  draft: GapDraft;
  segments: TripSegment[];
  onChange: (draft: GapDraft) => void;
}

/**
 * The via points in the order the route goes through them, numbered as on the map, each moved one
 * place earlier or later, or removed. Moving one past a photo or station makes the route bend
 * through it on the other side of it, such as on the walk from a bus stop to the next photo.
 */
export function ViaList({ day, draft, segments, onChange }: ViaListProps) {
  const ordered = viasInRouteOrder(draft, segments);
  if (ordered.length === 0) return null;
  const move = (via: PlacedVia, step: -1 | 1) => onChange(movedInRoute(draft, segments, via, step));
  return (
    <ol className="flex flex-col gap-1 text-sm" aria-label="Via points">
      {ordered.map((via, i) => (
        <li key={`${via.key}-${via.index}`} className="flex items-center gap-2">
          <ViaNumber n={i + 1} />
          <span className="text-muted-foreground min-w-0 flex-1 truncate">
            {whereOnRoute(via, day, segments)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move via point ${i + 1} earlier`}
            disabled={!canMove(draft, segments, via, -1)}
            onClick={() => move(via, -1)}
          >
            <ArrowUp aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move via point ${i + 1} later`}
            disabled={!canMove(draft, segments, via, 1)}
            onClick={() => move(via, 1)}
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

/** "photo 3" for a photo on the day, by its place in the day. */
function photoName(day: TripDay, id: number | undefined): string {
  const n = day.photos.findIndex((p) => p.id === id);
  return n === -1 ? "a photo no longer on the line" : `photo ${n + 1}`;
}

/** The walk to or from a station of a hop with a line, by the hop's first photo, as the list names it. */
function walkName(day: TripDay, segments: TripSegment[], end: WalkEnd, a: number): string {
  const hop = segments.find((s) => s.line && s.photos[0] === a);
  const station = hop?.[end]?.label ?? "the station";
  if (end === "board") return `Walk from ${photoName(day, a)} to ${station}`;
  return `Walk from ${station} to ${photoName(day, hop?.photos[1])}`;
}

/**
 * Where the via point is on the route: on the walk to or from a station of a hop with a line, after
 * the start spot, or after a photo.
 */
function whereOnRoute({ key }: PlacedVia, day: TripDay, segments: TripSegment[]): string {
  const walk = walkOfKey(key);
  if (walk) return walkName(day, segments, walk.end, walk.a);
  return key === "start" ? "After the start spot" : `After ${photoName(day, Number(key))}`;
}
