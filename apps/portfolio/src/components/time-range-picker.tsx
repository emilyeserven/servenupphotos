import { format, subMonths } from "date-fns";
import { CalendarClock, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  absoluteTimeRange,
  activeQuickRange,
  describeTimeRange,
  getAbsoluteDates,
  type QuickRangeKey,
  quickRanges,
  type TimeRangeValue,
} from "@/lib/time-range";

/** A Grafana-style time range picker: quick relative ranges plus an absolute from/to calendar. */
export function TimeRangePicker({
  value,
  onChange,
}: {
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
}) {
  const [open, setOpen] = useState(false);

  function apply(next: TimeRangeValue) {
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-56 justify-between">
          <span className="flex items-center gap-2">
            <CalendarClock aria-hidden />
            {describeTimeRange(value)}
          </span>
          <ChevronDown className="opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex max-h-(--radix-popover-content-available-height) w-auto flex-col overflow-y-auto p-0 sm:flex-row"
      >
        <AbsoluteRangeForm initial={getAbsoluteDates(value)} onApply={apply} />
        <QuickRangeList active={activeQuickRange(value)} onApply={apply} />
      </PopoverContent>
    </Popover>
  );
}

function AbsoluteRangeForm({
  initial,
  onApply,
}: {
  initial?: { from: Date; to: Date };
  onApply: (value: TimeRangeValue) => void;
}) {
  // Mounted fresh each time the popover opens, so these capture "today" at open time.
  const [today] = useState(() => new Date());
  const [defaultMonth] = useState(() => initial?.from ?? subMonths(today, 1));
  const [draft, setDraft] = useState<DateRange | undefined>(initial);
  const complete = getAbsoluteDates({ ...draft });

  return (
    <div className="flex flex-col gap-3 border-b p-3 sm:border-r sm:border-b-0">
      <p className="text-sm font-medium">Absolute time range</p>
      <Calendar
        mode="range"
        numberOfMonths={2}
        defaultMonth={defaultMonth}
        selected={draft}
        onSelect={setDraft}
        disabled={{ after: today }}
        className="bg-transparent p-0"
      />
      <div className="flex items-center justify-between gap-3">
        <DraftLabel draft={draft} />
        <Button
          size="sm"
          disabled={!complete}
          onClick={() => complete && onApply(absoluteTimeRange(complete.from, complete.to))}
        >
          Apply time range
        </Button>
      </div>
    </div>
  );
}

function formatDraftDay(date: Date | undefined, placeholder: string) {
  return date ? format(date, "MMM d, yyyy") : placeholder;
}

function DraftLabel({ draft }: { draft?: DateRange }) {
  return (
    <p className="text-xs text-muted-foreground">
      {formatDraftDay(draft?.from, "From")} – {formatDraftDay(draft?.to, "To")}
    </p>
  );
}

function QuickRangeList({
  active,
  onApply,
}: {
  active?: QuickRangeKey;
  onApply: (value: TimeRangeValue) => void;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 sm:w-44">
      <p className="mb-1 text-sm font-medium">Quick ranges</p>
      {(Object.keys(quickRanges) as QuickRangeKey[]).map((key) => (
        <Button
          key={key}
          variant="ghost"
          size="sm"
          className={cn("justify-start", active === key && "bg-accent")}
          onClick={() => onApply(key === "all" ? {} : { range: key })}
        >
          {quickRanges[key].label}
        </Button>
      ))}
    </div>
  );
}
