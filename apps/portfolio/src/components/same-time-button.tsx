import { CalendarRange } from "lucide-react";
import { SAME_TIME_TEXT, type SameTime } from "@/lib/same-time";
import type { TimeRangeValue } from "@/lib/time-range";

/**
 * A Timeline photo's quick filter, such as **Same day · 8**, showing only the photos taken on its
 * day, or in its week or month, whichever is the most specific with more than five photos.
 * Nothing when none has, or when the Timeline already shows that time.
 */
export function SameTimeButton({
  same,
  onPick,
}: {
  same: SameTime | undefined;
  onPick: (range: TimeRangeValue) => void;
}) {
  if (!same) return null;
  return (
    <button
      type="button"
      onClick={() => onPick(same.range)}
      className="mt-0.5 inline-flex items-center gap-1 self-start rounded-sm text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CalendarRange className="size-3.5" aria-hidden />
      {SAME_TIME_TEXT[same.unit]}
      <span className="tabular-nums">· {same.count}</span>
    </button>
  );
}
