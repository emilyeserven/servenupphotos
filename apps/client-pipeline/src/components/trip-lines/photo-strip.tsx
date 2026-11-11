import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Flag, Play, Plus, Scissors } from "lucide-react";
import { photoName, squareUrl } from "@/components/group-photo-grid";
import type { TripVisit } from "@/api/trip-lines";
import { GAPS, gapInfo } from "@/components/trip-lines/modes";
import { VisitChips } from "@/components/trip-lines/visit-chips";
import { EndChip, StripEnd, type StripEnds } from "@/components/trip-lines/strip-ends";
import { Button } from "@/components/ui/button";
import { VisitInsert } from "@/components/trip-lines/visit-insert";
import { type StripVia, ViaChips } from "@/components/trip-lines/via-list";
import type { TripPhoto } from "@/lib/trip-days";
import type { Gap } from "@/lib/trip-gaps";
import { firstStops, offRoute, visitsAfter } from "@/lib/trip-visits";
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
  /** Moves a trip stop one photo earlier or later on the route; left out, they can't move. */
  onMoveVisit?: (visit: TripVisit, by: -1 | 1) => void;
  /** Puts a trip stop on the route right after photo `after`; left out, none can be put there. */
  onInsertVisit?: (after: number, visit: TripVisit) => void;
  /** Puts a trip stop on the route before the day's first photo; left out, none can be put there. */
  onInsertFirst?: (visit: TripVisit) => void;
  /** Takes a trip stop off the route; left out, they can't be taken off. */
  onOffVisit?: (visit: TripVisit) => void;
  /** The day's trip stops; the ones put on the route show between their two photos. */
  visits?: TripVisit[];
  /** The via points by the photo they show before, numbered as on the map; left out, none show. */
  vias?: Map<number, StripVia[]>;
  /**
   * How the day got from its start spot, or the trip stop before the first photo, to the first
   * photo; left out when it has neither, so no way shows before the first photo.
   */
  startGap?: Gap;
  /**
   * Whether the strip's last photo is the day's last, so the trip stops the route ends at show after
   * it; left out, it is.
   */
  endsDay?: boolean;
  /**
   * The day's start and end spots, shown and set from the Start and End at the strip's ends while
   * the day has a line; left out, neither shows.
   */
  ends?: StripEnds;
}

/** The day's photos in the order they were taken, with what happened between each two. */
export function PhotoStrip(props: PhotoStripProps) {
  const { photos, visits, vias, offset = 0, endsDay = true, ...rest } = props;
  const choices = offRoute(visits);
  // Relative, so screen-reader labels (absolutely placed) scroll with the strip instead of widening the page.
  return (
    <ol
      className="relative flex items-center gap-1 overflow-x-auto pb-2"
      aria-label="The day's photos"
    >
      {photos.map((p, i) => (
        <StripItem
          key={p.id}
          photo={p}
          local={i}
          offset={offset}
          prev={photos[i - 1]}
          before={stopsBefore(visits, photos[i - 1]?.id, offset + i)}
          viasBefore={vias?.get(p.id)}
          endsAtStop={endsDay && i === photos.length - 1 && visitsAfter(visits, p.id).length > 0}
          choices={choices}
          {...rest}
        />
      ))}
      {endsDay && props.ends && <RouteEnd {...props} ends={props.ends} choices={choices} />}
    </ol>
  );
}

/**
 * The trip stops the route ends at after the strip's last photo, and putting one there while the
 * day has a line and stops can be put on it; nothing for a strip with no photos.
 */
function RouteEnd(props: PhotoStripProps & { choices: TripVisit[]; ends: StripEnds }) {
  const { photos, visits, gaps, choices, onInsertVisit, onMoveVisit, onOffVisit, ends } = props;
  const last = photos.at(-1);
  if (!last || !gaps || !onInsertVisit) return null;
  return (
    <StripEnd
      stops={visitsAfter(visits, last.id)}
      choices={choices}
      ends={ends}
      onInsert={(visit) => onInsertVisit(last.id, visit)}
      onMove={onMoveVisit}
      onOff={onOffVisit}
    />
  );
}

/**
 * The trip stops the strip shows before the photo at index i of the day: those put before the
 * first photo for the day's first, or else those after the photo before it in this strip.
 */
function stopsBefore(visits: TripVisit[] | undefined, prev: number | undefined, i: number) {
  return i === 0 ? firstStops(visits) : visitsAfter(visits, prev);
}

interface StripItemProps extends Omit<PhotoStripProps, "photos" | "visits" | "vias"> {
  photo: TripPhoto;
  /** The photo before it in the strip; none for the strip's first. */
  prev?: TripPhoto;
  /** The trip stops on the route between the photo before and this one. */
  before: TripVisit[];
  /** The via points on the way to this photo. */
  viasBefore?: StripVia[];
  /** The day's trip stops not on the route yet, which can be put before this photo. */
  choices: TripVisit[];
  /** Whether the route goes on from this photo, the day's last, to the trip stops it ends at. */
  endsAtStop?: boolean;
  /** Its index among the strip's photos. */
  local: number;
  offset: number;
}

/** One photo in the strip, after the gap before it (none before the strip's first photo). */
function StripItem(props: StripItemProps) {
  const { photo, local, offset, gaps, onHover, onMove, endsAtStop } = props;
  const i = offset + local;
  return (
    <li className="flex shrink-0 items-center gap-1">
      {i === 0 ? <FromStart {...props} /> : <Between {...props} i={i} />}
      <StripPhoto
        photo={photo}
        n={i + 1}
        ends={endsAtStop ? { ...endsAt(gaps, i), ends: false } : endsAt(gaps, i)}
        onHover={onHover}
        onMove={onMove}
      />
    </li>
  );
}

/**
 * What comes between the photo before and this one: the trip stops there, with the way there
 * on both sides of them, so the mode shows before and after each place.
 */
function Between(props: StripItemProps & { i: number }) {
  const { photo, prev, gaps, onGap, onSplit, i } = props;
  const chips = <StopsHere {...props} />;
  if (!gaps || !prev) return chips;
  const picker = { gap: gapBefore(gaps, i), index: i - 1, onGap };
  return (
    <>
      <PlacesVisited shown={hasStops(props)} {...picker}>
        {chips}
      </PlacesVisited>
      <GapColumn
        {...picker}
        onSplit={onSplit && (() => onSplit(photo.id))}
        insert={insertBetween(prev, props.choices, props.onInsertVisit)}
      />
    </>
  );
}

/**
 * What comes before the day's first photo: the trip stops there, then how the day got from them
 * (or its start spot) to the photo, which can be changed like any gap.
 */
function FromStart(props: StripItemProps) {
  const { startGap, gaps, onGap } = props;
  if (!startGap || !gaps) return <StartStops {...props} />;
  return (
    <>
      <StartStops {...props} />
      <GapPicker gap={startGap} index={-1} onGap={onGap} choices={START_GAPS} />
    </>
  );
}

/**
 * Where the day starts while it has a line (its start spot, or putting a trip stop there), then
 * the trip stops before the first photo.
 */
function StartStops(props: StripItemProps) {
  const { gaps, onInsertFirst, choices, ends, before } = props;
  return (
    <>
      {gaps && onInsertFirst && ends && (
        <EndChip
          which="start"
          ends={ends}
          stops={before}
          choices={choices}
          onInsert={onInsertFirst}
        />
      )}
      <StopsHere {...props} />
    </>
  );
}

/** The ways the day can get from its start to the first photo: any but a break or a wander. */
const START_GAPS = GAPS.filter((g) => g.gap !== "break" && g.gap !== "wander");

/** Whether any trip stops or via points are between the photo before and this one. */
function hasStops({ before, viasBefore = [] }: StripItemProps): boolean {
  return before.length + viasBefore.length > 0;
}

/** The via points, then the trip stops, between the photo before and this one, in route order. */
function StopsHere({ before, viasBefore, onMoveVisit, onOffVisit }: StripItemProps) {
  return (
    <>
      <ViaChips vias={viasBefore} />
      <VisitChips visits={before} onMove={onMoveVisit} onOff={onOffVisit} />
    </>
  );
}

interface PlacesVisitedProps extends GapPickerProps {
  /** Whether any trip stops or via points are between the two photos. */
  shown: boolean;
  /** The places' icons. */
  children: React.ReactNode;
}

/**
 * The trip stops and via points between two photos, after the way there, raised by the height of the cut row
 * under the gap after them so the two ways and the places line up; nothing when none were visited.
 */
function PlacesVisited({ shown, children, ...picker }: PlacesVisitedProps) {
  if (!shown) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1">
        <GapPicker {...picker} />
        {children}
      </span>
      <span className="h-[18px]" aria-hidden />
    </div>
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

/** Putting a trip stop between two photos: the places that can go there, and what puts one. */
interface InsertBetween {
  choices: TripVisit[];
  onInsert: (visit: TripVisit) => void;
}

/** What puts a trip stop right after photo a, when places can be put on the route. */
function insertBetween(
  a: TripPhoto,
  choices: TripVisit[],
  onInsertVisit: ((after: number, visit: TripVisit) => void) | undefined,
): InsertBetween | undefined {
  return onInsertVisit && { choices, onInsert: (visit) => onInsertVisit(a.id, visit) };
}

interface GapColumnProps extends GapPickerProps {
  /** Cuts to a new place here: the photo after the gap starts a new group. */
  onSplit?: () => void;
  /** Adds a trip stop here. */
  insert?: InsertBetween;
}

/**
 * What happened between two photos, with a plus under it that adds something here: a trip stop,
 * or a new group starting at the next photo.
 */
function GapColumn({ onSplit, insert, ...picker }: GapColumnProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <GapPicker {...picker} />
      {insert && (
        <VisitInsert
          {...insert}
          icon={Plus}
          title="Add a trip stop or a new group here"
          className="text-muted-foreground hover:text-foreground"
          actions={onSplit && ((close) => <CutButton onClick={() => (onSplit(), close())} />)}
        />
      )}
    </div>
  );
}

/** Cuts the strip here into a new group: a new place between these areas. */
function CutButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="justify-start border-b" onClick={onClick}>
      <Scissors aria-hidden />
      Start a new group here
    </Button>
  );
}

/**
 * A start arrow and an end flag over a photo where a line starts or ends. Not a pin, so it isn't
 * read as the photo having (or lacking) a GPS position: every photo in the strip has an exact spot.
 */
function Ends({ starts, ends }: LineEnds) {
  return (
    <span className="absolute top-1 left-1 flex gap-0.5">
      {starts && <Badge title="A line starts here" icon={<Play className="size-3" />} />}
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
  /** The gap's index; -1 for the way from the day's start to its first photo. */
  index: number;
  onGap?: (index: number, gap: Gap) => void;
  /** The ways it can be changed to; every gap when left out. */
  choices?: typeof GAPS;
}

/** What the gap at index is between, for screen readers. */
function gapName(index: number): string {
  if (index === -1) return "From the start to photo 1";
  return `Between photos ${index + 1} and ${index + 2}`;
}

/** What happened between two photos: an icon, and a menu to change it when the strip can. */
function GapPicker({ gap, index, onGap, choices = GAPS }: GapPickerProps) {
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
          aria-label={gapName(index)}
          className="absolute inset-0 cursor-pointer opacity-0"
          value={gap}
          onChange={(e) => onGap(index, e.target.value as Gap)}
        >
          {choices.map((g) => (
            <option key={g.gap} value={g.gap}>
              {g.label}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}
