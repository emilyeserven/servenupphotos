import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Flag, MapPin, Scissors } from "lucide-react";
import { photoName, squareUrl } from "@/components/group-photo-grid";
import type { TripVisit } from "@/api/trip-lines";
import { GAPS, gapInfo } from "@/components/trip-lines/modes";
import { VisitChips } from "@/components/trip-lines/visit-chips";
import { VisitInsert } from "@/components/trip-lines/visit-insert";
import type { TripPhoto } from "@/lib/trip-days";
import type { Gap } from "@/lib/trip-gaps";
import { visitsAfter } from "@/lib/trip-visits";
import { cn } from "@/lib/utils";

interface PhotoStripProps {
  photos: TripPhoto[];
  /** What happened between each two photos; left out while the day has no line, so none show. */
  gaps?: Gap[];
  /** Changes one gap; left out, the strip only shows them. */
  onGap?: (index: number, gap: Gap) => void;
  /** The photo pointed at, which the map highlights. */
  onHover: (id: number | undefined) => void;
  /** Where these photos start among the day's, when they're one group of them: gaps count from 0. */
  offset?: number;
  /** Starts a new group at a photo; left out, photos can't start one. */
  onSplit?: (id: number) => void;
  /** Moves a photo one place earlier (-1) or later (1) in the day; left out, photos can't move. */
  onMove?: (id: number, by: -1 | 1) => void;
  /** Moves a place visited one photo earlier or later on the route; left out, they can't move. */
  onMoveVisit?: (visit: TripVisit, by: -1 | 1) => void;
  /** Adds a place visited to the route right after photo `after`; left out, none can be added. */
  onInsertVisit?: (after: number, visit: TripVisit) => void;
  /** The day's places visited; the ones put on the route show between their two photos. */
  visits?: TripVisit[];
}

/** The day's photos in the order they were taken, with what happened between each two. */
export function PhotoStrip({ photos, visits, offset = 0, ...rest }: PhotoStripProps) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-2" aria-label="The day's photos">
      {photos.map((p, i) => (
        <StripItem
          key={p.id}
          photo={p}
          local={i}
          offset={offset}
          prev={photos[i - 1]}
          before={visitsAfter(visits, photos[i - 1]?.id)}
          {...rest}
        />
      ))}
    </ol>
  );
}

interface StripItemProps extends Omit<PhotoStripProps, "photos" | "visits"> {
  photo: TripPhoto;
  /** The photo before it in the strip; none for the strip's first. */
  prev?: TripPhoto;
  /** The places visited on the route between the photo before and this one. */
  before: TripVisit[];
  /** Its index among the strip's photos. */
  local: number;
  offset: number;
}

/** One photo in the strip, after the gap before it (none before the strip's first photo). */
function StripItem(props: StripItemProps) {
  const { photo, prev, local, offset, gaps, onGap, onHover, onSplit, onMove, before } = props;
  const i = offset + local;
  return (
    <li className="flex shrink-0 items-center gap-1">
      <VisitChips visits={before} onMove={props.onMoveVisit} />
      {gaps && prev && (
        <GapColumn
          gap={gapBefore(gaps, i)}
          index={i - 1}
          onGap={onGap}
          onSplit={onSplit && (() => onSplit(photo.id))}
          insert={insertBetween(prev, photo, props.onInsertVisit)}
        />
      )}
      <StripPhoto
        photo={photo}
        n={i + 1}
        ends={endsAt(gaps, i)}
        onHover={onHover}
        onMove={onMove}
      />
    </li>
  );
}

/** Where lines start and end at the photo at index i; nowhere while the day has no line. */
function endsAt(gaps: Gap[] | undefined, i: number): LineEnds {
  return gaps ? lineEnds(gaps, i) : NO_ENDS;
}

/** Whether a line starts and ends at a photo. */
interface LineEnds {
  starts: boolean;
  ends: boolean;
}

const NO_ENDS: LineEnds = { starts: false, ends: false };

/** The gap before the photo at index i; the first photo has none, so a line starts there. */
function gapBefore(gaps: Gap[], i: number): Gap {
  return gaps[i - 1] ?? "break";
}

/**
 * Whether a line starts at the photo at index i (the first, or one after a gap that isn't walking)
 * and ends there (the last, or one before a gap that isn't walking).
 */
function lineEnds(gaps: Gap[], i: number): LineEnds {
  return { starts: gapBefore(gaps, i) !== "walk", ends: (gaps[i] ?? "break") !== "walk" };
}

interface StripPhotoProps {
  photo: TripPhoto;
  /** Its number among the day's photos, counting from 1, as the map's dots show it. */
  n: number;
  ends: LineEnds;
  onHover: (id: number | undefined) => void;
  onMove?: (id: number, by: -1 | 1) => void;
}

function StripPhoto({ photo, n, ends, onHover, onMove }: StripPhotoProps) {
  const url = squareUrl(photo.photo);
  return (
    <figure
      className="group/photo flex w-20 flex-col items-center gap-1"
      onMouseEnter={() => onHover(photo.id)}
      onMouseLeave={() => onHover(undefined)}
    >
      <div className="bg-muted relative size-20 overflow-hidden rounded-md">
        <PhotoLink id={photo.id}>
          {url && <img src={url} alt={photoName(photo.photo)} className="size-full object-cover" />}
        </PhotoLink>
        <Ends {...ends} />
        {onMove && <MoveButtons onMove={(by) => onMove(photo.id, by)} />}
      </div>
      <figcaption className="text-muted-foreground text-xs tabular-nums">
        <span className="text-foreground font-medium" title="Its number on the map">
          {n}
        </span>{" "}
        · {photo.time}
      </figcaption>
    </figure>
  );
}

/**
 * Opens the photo's editor in a new tab, to change its Place or anything else; the photo's group
 * here follows its new Place once this page is reloaded.
 */
function PhotoLink({ id, children }: { id: number; children: React.ReactNode }) {
  return (
    <Link
      to="/exif"
      search={{ photo: id }}
      target="_blank"
      title="Edit this photo, such as its Place, in a new tab"
      className="block size-full"
    >
      {children}
    </Link>
  );
}

/** Shown on hover or focus only. */
const ON_HOVER = "opacity-0 focus-visible:opacity-100";

/**
 * Moves the photo one place earlier or later in the day, such as when the camera's clock was off;
 * shown over the photo while it's pointed at.
 */
function MoveButtons({ onMove }: { onMove: (by: -1 | 1) => void }) {
  const button = cn(
    "bg-background/90 rounded-sm p-0.5 shadow-sm group-hover/photo:opacity-100",
    ON_HOVER,
  );
  return (
    <span className="absolute right-1 bottom-1 flex gap-0.5">
      <button type="button" title="Move earlier" className={button} onClick={() => onMove(-1)}>
        <ChevronLeft className="size-3" aria-hidden />
        <span className="sr-only">Move earlier</span>
      </button>
      <button type="button" title="Move later" className={button} onClick={() => onMove(1)}>
        <ChevronRight className="size-3" aria-hidden />
        <span className="sr-only">Move later</span>
      </button>
    </span>
  );
}

/** Adding a place visited between two photos: the photos, and what adds it. */
interface InsertBetween {
  a: TripPhoto;
  b: TripPhoto;
  onInsert: (visit: TripVisit) => void;
}

/** What adds a place visited between a and b, when places can be added. */
function insertBetween(
  a: TripPhoto,
  b: TripPhoto,
  onInsertVisit: ((after: number, visit: TripVisit) => void) | undefined,
): InsertBetween | undefined {
  return onInsertVisit && { a, b, onInsert: (visit) => onInsertVisit(a.id, visit) };
}

interface GapColumnProps extends GapPickerProps {
  /** Cuts to a new place here: the photo after the gap starts a new group. */
  onSplit?: () => void;
  /** Adds a place visited here. */
  insert?: InsertBetween;
}

/**
 * What happened between two photos, with the scissors and adding a place visited under it, shown
 * on hover.
 */
function GapColumn({ onSplit, insert, ...picker }: GapColumnProps) {
  return (
    <div className="group/gap flex flex-col items-center gap-1">
      <GapPicker {...picker} />
      <span className="flex">
        {onSplit && <CutButton onClick={onSplit} />}
        {insert && (
          <VisitInsert {...insert} className={cn("group-hover/gap:opacity-100", ON_HOVER)} />
        )}
      </span>
    </div>
  );
}

/** Cuts the strip here into a new group: a new place between these areas. */
function CutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Cut to a new place here"
      onClick={onClick}
      className={cn("hover:bg-muted rounded-sm p-0.5 group-hover/gap:opacity-100", ON_HOVER)}
    >
      <Scissors className="size-3.5" aria-hidden />
      <span className="sr-only">Cut to a new place here</span>
    </button>
  );
}

/** A start pin and an end flag over a photo where a line starts or ends. */
function Ends({ starts, ends }: LineEnds) {
  return (
    <span className="absolute top-1 left-1 flex gap-0.5">
      {starts && <Badge title="A line starts here" icon={<MapPin className="size-3" />} />}
      {ends && <Badge title="A line ends here" icon={<Flag className="size-3" />} />}
    </span>
  );
}

function Badge({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <span title={title} className="bg-background/90 rounded-sm p-0.5 shadow-sm">
      {icon}
    </span>
  );
}

interface GapPickerProps {
  gap: Gap;
  index: number;
  onGap?: (index: number, gap: Gap) => void;
}

/** What happened between two photos: an icon, and a menu to change it when the strip can. */
function GapPicker({ gap, index, onGap }: GapPickerProps) {
  const { icon: Icon, label } = gapInfo(gap);
  return (
    <label
      title={label}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-md border",
        gap === "break" ? "border-dashed" : "bg-muted",
        onGap && "hover:bg-accent cursor-pointer",
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{label}</span>
      {onGap && (
        <select
          aria-label={`Between photos ${index + 1} and ${index + 2}`}
          className="absolute inset-0 cursor-pointer opacity-0"
          value={gap}
          onChange={(e) => onGap(index, e.target.value as Gap)}
        >
          {GAPS.map((g) => (
            <option key={g.gap} value={g.gap}>
              {g.label}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}
