import { Flag, MapPin } from "lucide-react";
import { photoName, squareUrl } from "@/components/group-photo-grid";
import { GAPS, gapInfo } from "@/components/trip-lines/modes";
import type { TripPhoto } from "@/lib/trip-days";
import type { Gap } from "@/lib/trip-gaps";
import { cn } from "@/lib/utils";

interface PhotoStripProps {
  photos: TripPhoto[];
  /** What happened between each two photos; left out while the day has no line, so none show. */
  gaps?: Gap[];
  /** Changes one gap; left out, the strip only shows them. */
  onGap?: (index: number, gap: Gap) => void;
  /** The photo pointed at, which the map highlights. */
  onHover: (id: number | undefined) => void;
}

/** The day's photos in the order they were taken, with what happened between each two. */
export function PhotoStrip({ photos, gaps, onGap, onHover }: PhotoStripProps) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-2" aria-label="The day's photos">
      {photos.map((p, i) => (
        <li key={p.id} className="flex shrink-0 items-center gap-1">
          {gaps && i > 0 && <GapPicker gap={gapBefore(gaps, i)} index={i - 1} onGap={onGap} />}
          <StripPhoto photo={p} ends={gaps ? lineEnds(gaps, i) : NO_ENDS} onHover={onHover} />
        </li>
      ))}
    </ol>
  );
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
}

function StripPhoto({ photo, ends, onHover }: StripPhotoProps) {
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
      </div>
      <figcaption className="text-muted-foreground text-xs tabular-nums">{photo.time}</figcaption>
    </figure>
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
