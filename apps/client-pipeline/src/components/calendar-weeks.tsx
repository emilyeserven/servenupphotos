import { useState } from "react";
import { SELECT_CLASS } from "@portfolio/lib/segmented-control";

/** The numbers of weeks the Instagram calendar can show at once. */
const WEEK_CHOICES = [2, 3, 4, 6, 8, 12];

/** How many weeks the calendar shows until another number is picked. */
const DEFAULT_WEEKS = 3;

const STORAGE_KEY = "pipeline-instagram-calendar-weeks";

/** The number of weeks picked last time, read from the browser; the default when it can't be read. */
function readWeeks(): number {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return WEEK_CHOICES.includes(saved) ? saved : DEFAULT_WEEKS;
  } catch {
    return DEFAULT_WEEKS;
  }
}

/** How many weeks the Instagram calendar shows, kept in the browser so a reload keeps it. */
export function useCalendarWeeks() {
  const [weeks, setWeeksState] = useState(readWeeks);
  const setWeeks = (next: number) => {
    setWeeksState(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Not kept for next time, which is fine.
    }
  };
  return { weeks, setWeeks };
}

/** The menu by the week buttons that picks how many weeks the calendar shows. */
export function WeeksSelect({
  weeks,
  onWeeks,
}: {
  weeks: number;
  onWeeks: (weeks: number) => void;
}) {
  return (
    <select
      value={weeks}
      aria-label="Weeks shown"
      onChange={(e) => onWeeks(Number(e.target.value))}
      className={SELECT_CLASS}
    >
      {WEEK_CHOICES.map((n) => (
        <option key={n} value={n}>
          {n} weeks
        </option>
      ))}
    </select>
  );
}
