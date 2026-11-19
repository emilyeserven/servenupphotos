import { END_GAP, type Gap } from "@/lib/trip-gaps";
import { GAPS, gapInfo } from "@/components/trip-lines/modes";
import { cn } from "@/lib/utils";

/** The ways the day can go from its start to the first photo, or from the last photo to its end. */
export const END_GAPS = GAPS.filter((g) => g.gap !== "break" && g.gap !== "wander");

export interface GapPickerProps {
  gap: Gap;
  /** The gap's index; -1 for the way from the day's start to its first photo, END_GAP from the last photo to its end. */
  index: number;
  onGap?: (index: number, gap: Gap) => void;
  /** The ways it can be changed to; every gap when left out. */
  choices?: typeof GAPS;
}

/** What the gap at index is between, for screen readers. */
function gapName(index: number): string {
  if (index === -1) return "From the start to photo 1";
  if (index === END_GAP) return "From the last photo to the end";
  return `Between photos ${index + 1} and ${index + 2}`;
}

/** What happened between two photos: an icon, and a menu to change it when the strip can. */
export function GapPicker({ gap, index, onGap, choices = GAPS }: GapPickerProps) {
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
