import { Flag, MapPin, Scissors } from "lucide-react";
import { photoName, squareUrl } from "@/components/group-photo-grid";
import type { TripVisit } from "@/api/trip-lines";
import { GAPS, gapInfo } from "@/components/trip-lines/modes";
import { VisitChips } from "@/components/trip-lines/visit-chips";
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
          before={visitsAfter(visits, photos[i - 1]?.id)}
          {...rest}
        />
      ))}
    </ol>
  );
}

interface StripItemProps extends Omit<PhotoStripProps, "photos" | "visits"> {
  photo: TripPhoto;
  /** The places visited on the route between the photo before and this one. */
  before: TripVisit[];
  /** Its index among the strip's photos. */
  local: number;
  offset: number;
}

/** One photo in the strip, after the gap before it (none before the strip's first photo). */
function StripItem(props: StripItemProps) {
  const { photo, local, offset, gaps, onGap, onHover, onSplit, before } = props;
  const i = offset + local;
  const first = local === 0;
  return (
    <li className="flex shrink-0 items-center gap-1">
      <VisitChips visits={before} />
      {gaps && !first && <GapPicker gap={gapBefore(gaps, i)} index={i - 1} onGap={onGap} />}
      <StripPhoto
        photo={photo}
        ends={endsAt(gaps, i)}
        onHover={onHover}
        onSplit={first ? undefined : onSplit}
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
  ends: LineEnds;
  onHover: (id: number | undefined) => void;
  onSplit?: (id: number) => void;
}

function StripPhoto({ photo, ends, onHover, onSplit }: StripPhotoProps) {
  const url = squareUrl(photo.photo);
  return (
    <figure
      className="flex w-20 flex-col items-center gap-1"
      onMouseEnter={() => onHover(photo.id)}
      onMouseLeave={() => onHover(undefined)}
    >
      <div className="bg-muted relative size-20 overflow-hidden rounded-md">
        {url && <img src={url} alt={photoName(photo.photo)} className="size-full object-cover" />}
        <Ends {...ends} />
        {onSplit && <SplitButton onClick={() => onSplit(photo.id)} />}
      </div>
      <figcaption className="text-muted-foreground text-xs tabular-nums">{photo.time}</figcaption>
    </figure>
  );
}

/** Starts a new group at the photo, shown over it. */
function SplitButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Start a new group here"
      onClick={onClick}
      className="bg-background/90 absolute right-1 bottom-1 rounded-sm p-0.5 shadow-sm"
    >
      <Scissors className="size-3" aria-hidden />
      <span className="sr-only">Start a new group here</span>
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
