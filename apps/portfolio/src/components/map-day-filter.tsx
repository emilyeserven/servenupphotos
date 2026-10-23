import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import type { MapDay } from "@/lib/map-days";

/** A day as the dropdown writes it, such as "Sat, May 16, 2026". */
function dayText(day: string): string {
  return format(parseISO(day), "EEE, MMM d, yyyy");
}

/**
 * The chosen day stays a choice even once the map has moved away from its photos, so it can still
 * be seen and changed.
 */
function withChosen(days: MapDay[], chosen: string | undefined): MapDay[] {
  if (!chosen || days.some(({ day }) => day === chosen)) return days;
  return [{ day: chosen, count: 0 }, ...days];
}

/**
 * A dropdown narrowing the map to the photos taken on one day. It only lists the days of the
 * photos in view, with how many photos each has there, so it changes as the map moves.
 */
export function MapDayFilter({
  days,
  day,
  onChange,
}: {
  days: MapDay[];
  day: string | undefined;
  onChange: (day: string | undefined) => void;
}) {
  const choices = withChosen(days, day);
  return (
    <label className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-sm font-medium text-muted-foreground shadow-xs dark:border-input">
      <CalendarDays className="size-4" aria-hidden />
      <span className="sr-only">Day</span>
      <select
        value={day ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="h-full max-w-48 cursor-pointer bg-transparent text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">All days in view</option>
        {choices.map((choice) => (
          <option key={choice.day} value={choice.day}>
            {dayText(choice.day)}
            {choice.count > 0 && ` (${choice.count})`}
          </option>
        ))}
      </select>
    </label>
  );
}
