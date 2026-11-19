import { ArrowDown, ArrowUp, ListOrdered, X } from "lucide-react";
import type { TripSegment } from "@/api/trip-lines";
import { Button } from "@/components/ui/button";
import type { TripDay } from "@/lib/trip-days";
import type { GapDraft, ViaKey } from "@/lib/trip-gaps";
import { movedVia } from "@/lib/trip-points";
import { type WalkEnd, walkOfKey } from "@/lib/station-walks";
import {
  canMove,
  movedInRoute,
  type PlacedVia,
  photoAfter,
  viasInRouteOrder,
  walkViaKeys,
} from "@/lib/via-order";
import { sharedBy, viaInWalkingOrder, viaOutOfOrder, withViaBy } from "@/lib/via-tidy";
import { ViaBySelect } from "@/components/trip-lines/via-by-select";

interface ViaListProps {
  day: TripDay;
  draft: GapDraft;
  segments: TripSegment[];
  onChange: (draft: GapDraft) => void;
}

/** The via points of one stretch (the list after one key), with their numbers on the map. */
interface Stretch {
  key: ViaKey;
  vias: { via: PlacedVia; n: number }[];
}

/** The via points in route order, numbered from 1, in runs that share a stretch. */
function stretches(ordered: PlacedVia[]): Stretch[] {
  const out: Stretch[] = [];
  ordered.forEach((via, i) => {
    const last = out.at(-1);
    if (last?.key === via.key) last.vias.push({ via, n: i + 1 });
    else out.push({ key: via.key, vias: [{ via, n: i + 1 }] });
  });
  return out;
}

/**
 * The via points in the order the route goes through them, numbered as on the map, under the
 * stretch they're on. **Put in order** sorts each stretch's into the order a walk passes them. On a
 * walk, each via point (or a whole stretch's at once) says whether the walk goes to it by road or
 * walkway. Each moves one place earlier or later, or is removed; moving one past a photo or station
 * makes the route bend through it on the other side of it.
 */
export function ViaList({ day, draft, segments, onChange }: ViaListProps) {
  const ordered = viasInRouteOrder(draft, segments);
  if (ordered.length === 0) return null;
  const walks = walkViaKeys(segments);
  return (
    <div className="flex flex-col gap-2 text-sm">
      {viaOutOfOrder(draft, day.photos, segments) && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onChange(viaInWalkingOrder(draft, day.photos, segments))}
        >
          <ListOrdered aria-hidden /> Put in order
        </Button>
      )}
      <ol className="flex flex-col gap-2" aria-label="Via points">
        {stretches(ordered).map((stretch) => (
          <StretchVias
            key={stretch.key}
            stretch={stretch}
            title={whereOnRoute(stretch.key, day, segments)}
            onWalk={walks.has(stretch.key)}
            draft={draft}
            segments={segments}
            onChange={onChange}
          />
        ))}
      </ol>
    </div>
  );
}

interface StretchViasProps {
  stretch: Stretch;
  title: string;
  /** Whether the stretch is on a walk, so its via points say road or walkway. */
  onWalk: boolean;
  draft: GapDraft;
  segments: TripSegment[];
  onChange: (draft: GapDraft) => void;
}

/** One stretch's via points under its name, with a menu setting road or walkway for all of them. */
function StretchVias({ stretch, title, onWalk, draft, segments, onChange }: StretchViasProps) {
  const { key, vias } = stretch;
  return (
    <li className="flex flex-col gap-1">
      <StretchTitle
        title={title}
        setsAll={onWalk && vias.length > 1}
        draft={draft}
        viaKey={key}
        onChange={onChange}
      />
      <ol className="flex flex-col gap-1">
        {vias.map(({ via, n }) => (
          <ViaRow
            key={`${via.key}-${via.index}`}
            via={via}
            n={n}
            onWalk={onWalk}
            draft={draft}
            segments={segments}
            onChange={onChange}
          />
        ))}
      </ol>
    </li>
  );
}

interface StretchTitleProps {
  title: string;
  /** Whether it has a menu setting road or walkway for every via point of the stretch. */
  setsAll: boolean;
  draft: GapDraft;
  viaKey: ViaKey;
  onChange: (draft: GapDraft) => void;
}

/** A stretch's name, and on a walk with more than one via point, road or walkway for all of them. */
function StretchTitle({ title, setsAll, draft, viaKey, onChange }: StretchTitleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{title}</span>
      {setsAll && (
        <ViaBySelect
          label={`${title}: every via point goes by`}
          value={sharedBy(draft.via?.[viaKey] ?? [])}
          onChange={(by) => onChange(withViaBy(draft, viaKey, by))}
        />
      )}
    </div>
  );
}

interface ViaRowProps {
  via: PlacedVia;
  /** Its number on the map. */
  n: number;
  /** Whether it's on a walk, so it says road or walkway. */
  onWalk: boolean;
  draft: GapDraft;
  segments: TripSegment[];
  onChange: (draft: GapDraft) => void;
}

/** One via point: its number, road or walkway on a walk, moving it earlier or later, and removing it. */
function ViaRow({ via, n, onWalk, draft, segments, onChange }: ViaRowProps) {
  const move = (step: -1 | 1) => onChange(movedInRoute(draft, segments, via, step));
  return (
    <li className="flex items-center gap-2">
      <ViaNumber n={n} />
      <span className="flex-1" />
      {onWalk && (
        <ViaBySelect
          label={`Via point ${n} goes by`}
          value={draft.via?.[via.key]?.[via.index]?.by ?? ""}
          onChange={(by) => onChange(withViaBy(draft, via.key, by, via.index))}
        />
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Move via point ${n} earlier`}
        disabled={!canMove(draft, segments, via, -1)}
        onClick={() => move(-1)}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Move via point ${n} later`}
        disabled={!canMove(draft, segments, via, 1)}
        onClick={() => move(1)}
      >
        <ArrowDown aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove via point ${n}`}
        onClick={() => onChange(movedVia(draft, via.key, via.index, null))}
      >
        <X aria-hidden />
      </Button>
    </li>
  );
}

/** A via point as the photo strip shows it: its number on the map, and where it is on the route. */
export interface StripVia {
  n: number;
  label: string;
}

/**
 * The via points by the photo the strip shows them before: the one their stretch leads to, so
 * they sit between the same two photos as on the map. Ones on the way to the end spot are left out.
 */
export function stripVias(
  day: TripDay,
  draft: GapDraft,
  segments: TripSegment[],
): Map<number, StripVia[]> {
  const ids = day.photos.map((p) => p.id);
  const out = new Map<number, StripVia[]>();
  viasInRouteOrder(draft, segments).forEach((via, i) => {
    const next = photoAfter(via.key, ids, segments);
    if (next === undefined) return;
    const label = `Via point ${i + 1}: ${whereOnRoute(via.key, day, segments)}`;
    out.set(next, [...(out.get(next) ?? []), { n: i + 1, label }]);
  });
  return out;
}

/** The via points between two photos in the strip, numbered as on the map; nothing when none. */
export function ViaChips({ vias = [] }: { vias?: StripVia[] }) {
  if (vias.length === 0) return null;
  return (
    <span className="flex items-center gap-0.5" aria-label="Via points here">
      {vias.map(({ n, label }) => (
        <span key={n} title={label} aria-label={label}>
          <ViaNumber n={n} />
        </span>
      ))}
    </span>
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
function whereOnRoute(key: ViaKey, day: TripDay, segments: TripSegment[]): string {
  const walk = walkOfKey(key);
  if (walk) return walkName(day, segments, walk.end, walk.a);
  return key === "start" ? "After the start spot" : `After ${photoName(day, Number(key))}`;
}
