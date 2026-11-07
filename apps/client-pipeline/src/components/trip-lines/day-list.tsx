import { useState } from "react";
import type { TripLine } from "@/api/trip-lines";
import { dayTitle } from "@/components/trip-lines/day-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripDay } from "@/lib/trip-days";
import { cn } from "@/lib/utils";

/** Whether a day's line is marked by hand, automatic, or not there yet. */
type LineStatus = "Marked" | "Automatic" | "None";

const FILTERS: ("All" | LineStatus)[] = ["All", "Marked", "Automatic", "None"];

function statusOf(line: TripLine | undefined): LineStatus {
  if (!line) return "None";
  return line.auto ? "Automatic" : "Marked";
}

interface DayListProps {
  days: TripDay[];
  lines: Map<string, TripLine>;
  chosen: string;
  onChoose: (day: string) => void;
}

/** The days a trip line can be marked for, newest first, with each one's status and a filter by it. */
export function DayList({ days, lines, chosen, onChoose }: DayListProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const shown = days.filter((d) => filter === "All" || statusOf(lines.get(d.day)) === filter);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Days</CardTitle>
        <CardDescription>Days with two or more photos at two or more exact spots.</CardDescription>
        <div className="flex flex-wrap gap-1 pt-1" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs",
                filter === f && "bg-muted font-medium",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto">
        {shown.length === 0 && <p className="text-muted-foreground text-sm">None.</p>}
        {shown.map((d) => (
          <DayRow
            key={d.day}
            day={d}
            status={statusOf(lines.get(d.day))}
            chosen={d.day === chosen}
            onChoose={onChoose}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface DayRowProps {
  day: TripDay;
  status: LineStatus;
  chosen: boolean;
  onChoose: (day: string) => void;
}

function DayRow({ day, status, chosen, onChoose }: DayRowProps) {
  return (
    <button
      type="button"
      onClick={() => onChoose(day.day)}
      aria-current={chosen}
      className={cn(
        "hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
        chosen && "bg-muted font-medium",
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{dayTitle(day.day)}</span>
        <span className="text-muted-foreground text-xs font-normal">
          {day.photos.length} photos, {day.spots} spots
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-xs",
          status === "None" ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {status}
      </span>
    </button>
  );
}
