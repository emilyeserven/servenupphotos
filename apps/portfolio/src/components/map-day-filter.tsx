import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import type { DayRange, MapDay } from "@/lib/map-days";

/** A day as the dropdowns write it, such as "Sat, May 16, 2026". */
function dayText(day: string): string {
  return format(parseISO(day), "EEE, MMM d, yyyy");
}

/**
 * The chosen days stay choices even once the map has moved away from their photos, so they can
 * still be seen and changed. Newest first, like the days in view.
 */
function withChosen(days: MapDay[], chosen: (string | undefined)[]): MapDay[] {
  const missing = chosen.filter(
    (day): day is string => day !== undefined && !days.some((choice) => choice.day === day),
  );
  return [...days, ...missing.map((day) => ({ day, count: 0 }))].toSorted((a, b) =>
    b.day.localeCompare(a.day),
  );
}

const SELECT =
  "h-full max-w-48 cursor-pointer bg-transparent text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A day's choice, with how many of the photos in view were taken on it. */
function DayOption({ choice }: { choice: MapDay }) {
  return (
    <option value={choice.day}>
      {dayText(choice.day)}
      {choice.count > 0 && ` (${choice.count})`}
    </option>
  );
}

/**
 * Dropdowns narrowing the map to the photos taken on one day, or on a range of days. They only list
 * the days of the photos in view, with how many photos each has there, so they change as the map
 * moves. Once a day is chosen, a second dropdown can stretch it to another day in view, when there
 * is one, for every photo from the earlier day through the later one.
 */
export function MapDayFilter({
  days,
  range,
  onChange,
}: {
  days: MapDay[];
  range: DayRange;
  onChange: (range: DayRange) => void;
}) {
  const choices = withChosen(days, [range.day, range.to]);
  return (
    <div className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-sm font-medium text-muted-foreground shadow-xs dark:border-input">
      <CalendarDays className="size-4" aria-hidden />
      <label className="h-full">
        <span className="sr-only">Day</span>
        <select
          value={range.day ?? ""}
          onChange={(event) => onChange(rangeFrom(event.target.value, range.to))}
          className={SELECT}
        >
          <option value="">All days in view</option>
          {choices.map((choice) => (
            <DayOption key={choice.day} choice={choice} />
          ))}
        </select>
      </label>
      <RangeEnd choices={choices} range={range} onChange={onChange} />
    </div>
  );
}

/**
 * The range between the two days, whichever order they were picked in; just the day when `other`
 * is missing or the same day, and all days for "".
 */
function rangeFrom(day: string, other: string | undefined): DayRange {
  return day ? orderedRange(day, other) : {};
}

/** The day alone, or the two days as a range with the earlier first. */
function orderedRange(day: string, other: string | undefined): DayRange {
  if (!other || other === day) return { day };
  return other > day ? { day, to: other } : { day: other, to: day };
}

/** The days other than the day, which can make a range with it; none without a day. */
function otherDays(choices: MapDay[], day: string | undefined): MapDay[] {
  return day ? choices.filter((choice) => choice.day !== day) : [];
}

/**
 * The second dropdown, for the range's other end: only once a day is chosen and another is in view.
 * Either can be the earlier day; the range is put in order.
 */
function RangeEnd({
  choices,
  range,
  onChange,
}: {
  choices: MapDay[];
  range: DayRange;
  onChange: (range: DayRange) => void;
}) {
  const { day } = range;
  const others = otherDays(choices, day);
  if (!day || others.length === 0) return null;
  return (
    <label className="flex h-full items-center gap-1.5">
      <span aria-hidden>to</span>
      <span className="sr-only">Last day</span>
      <select
        value={range.to ?? ""}
        onChange={(event) => onChange(rangeFrom(day, event.target.value))}
        className={SELECT}
      >
        <option value="">Just this day</option>
        {others.map((choice) => (
          <DayOption key={choice.day} choice={choice} />
        ))}
      </select>
    </label>
  );
}
