import { CalendarRange, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Photo } from "@/lib/photos";
import { busyTimes, type BusyTime } from "@/lib/busy-times";
import type { TimeRangeValue } from "@/lib/time-range";
import { cn } from "@/lib/utils";

/**
 * The Timeline's **Quick dates** menu: the days, weeks and months with more than five photos,
 * newest first, each photo counted in its most specific one, and listed under the next less
 * specific unit (days under their week, weeks under their month, months under their year).
 * Picking one shows only its photos. Nothing when no time has more than five photos.
 */
export function QuickDatesPicker({
  photos,
  value,
  onChange,
}: {
  /** The photos the filters and search let through, at any time. */
  photos: Photo[];
  /** The time range shown now, so the busy time it matches reads as chosen. */
  value: TimeRangeValue;
  onChange: (range: TimeRangeValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const groups = busyTimes(photos);
  if (groups.length === 0) return null;
  const chosen = groups.flatMap(([, times]) => times).find((time) => isShown(time, value));

  function choose(range: TimeRangeValue) {
    onChange(range);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PickerButton chosen={chosen} />
      <PopoverContent align="start" className="flex max-h-96 w-64 flex-col overflow-y-auto p-1">
        {groups.map(([group, times]) => (
          <section key={group} className="flex flex-col gap-0.5 pb-1">
            <h3 className="px-2 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground">
              {group}
            </h3>
            {times.map((time) => (
              <TimeChoice
                key={time.name}
                time={time}
                active={time === chosen}
                onClick={() => choose(time.range)}
              />
            ))}
          </section>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** The button that opens the menu, naming the busy time shown now. */
function PickerButton({ chosen }: { chosen?: BusyTime }) {
  return (
    <PopoverTrigger asChild>
      <Button variant="outline" className={cn("justify-between gap-2", chosen && "bg-muted")}>
        <CalendarRange aria-hidden />
        {chosen?.name ?? "Quick dates"}
        <ChevronDown className="opacity-60" aria-hidden />
      </Button>
    </PopoverTrigger>
  );
}

/** Whether the Timeline shows exactly the busy time's dates. */
function isShown(time: BusyTime, value: TimeRangeValue): boolean {
  return time.range.from === value.from && time.range.to === value.to;
}

/** One busy time to pick, with how many photos it has. */
function TimeChoice({
  time,
  active,
  onClick,
}: {
  time: BusyTime;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-muted font-medium",
      )}
    >
      {time.name}
      <span className="text-xs text-muted-foreground tabular-nums">{time.count}</span>
    </button>
  );
}
