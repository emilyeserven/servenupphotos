import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect } from "react";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { arrowStep, shiftDay } from "@/lib/social-feed";

interface FeedDayPickerProps {
  /** The day the Social Feed preview shows, as YYYY-MM-DD. */
  day: string;
  /** Today, as YYYY-MM-DD. */
  today: string;
  onChange: (day: string) => void;
}

/** Whether a key press belongs to a field, a menu or the tabs, which use the arrow keys themselves. */
function ownsArrowKeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return (
    target.closest("input, textarea, select, [role=tablist], [role=dialog], [role=grid]") !== null
  );
}

/**
 * Steps the day with the left and right arrow keys anywhere on the page, unless the key is for a
 * field, a menu or the tabs, or comes with a modifier.
 */
function useArrowKeys(day: string, onChange: (day: string) => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const by = arrowStep(event);
      if (by === 0 || ownsArrowKeys(event.target)) return;
      event.preventDefault();
      onChange(shiftDay(day, by));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [day, onChange]);
}

/**
 * The day the Social Feed preview shows: a date picker between buttons for the day before and
 * after (also the left and right arrow keys), and a button back to today. Clearing it goes to today.
 */
export function FeedDayPicker({ day, today, onChange }: FeedDayPickerProps) {
  useArrowKeys(day, onChange);
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label="Day before"
        title="Day before (←)"
        onClick={() => onChange(shiftDay(day, -1))}
      >
        <ChevronLeftIcon />
      </Button>
      <DatePicker
        value={day}
        onChange={(next) => onChange(next || today)}
        aria-label="Show the feed as of"
        className="w-52"
      />
      <Button
        variant="outline"
        size="icon"
        aria-label="Day after"
        title="Day after (→)"
        onClick={() => onChange(shiftDay(day, 1))}
      >
        <ChevronRightIcon />
      </Button>
      <Button variant="outline" disabled={day === today} onClick={() => onChange(today)}>
        Today
      </Button>
    </div>
  );
}
