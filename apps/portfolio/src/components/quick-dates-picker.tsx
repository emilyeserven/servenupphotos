import { CalendarRange, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Photo } from "@/lib/photos";
import { QUICK_DATES, quickDateChoices, quickDateDetail, type QuickDate } from "@/lib/quick-dates";
import { cn } from "@/lib/utils";

/**
 * The Timeline's **Quick dates** menu: the photos taken at this time of year in earlier years, on
 * this date, in this month or in this season. Choices with fewer than five photos are left out,
 * and the menu with them when none has five.
 */
export function QuickDatesPicker({
  photos,
  now,
  value,
  onChange,
}: {
  /** The photos the filters and search let through, at any time. */
  photos: Photo[];
  now: Date;
  /** The chosen choice, or undefined for none. */
  value?: QuickDate;
  onChange: (when: QuickDate) => void;
}) {
  const [open, setOpen] = useState(false);
  const choices = quickDateChoices(photos, now);
  if (choices.length === 0) return null;

  function choose(when: QuickDate) {
    onChange(when);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PickerButton value={value} />
      <PopoverContent align="start" className="flex w-64 flex-col gap-0.5 p-1">
        <h3 className="px-2 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground">
          This time, previous years
        </h3>
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={value === choice.value}
            onClick={() => choose(choice.value)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
              value === choice.value && "bg-muted font-medium",
            )}
          >
            <span>
              {choice.label}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {quickDateDetail(choice.value, now)}
              </span>
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{choice.count}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** The button that opens the menu, naming the chosen choice. */
function PickerButton({ value }: { value?: QuickDate }) {
  const chosen = QUICK_DATES.find((choice) => choice.value === value);
  return (
    <PopoverTrigger asChild>
      <Button variant="outline" className={cn("justify-between gap-2", chosen && "bg-muted")}>
        <CalendarRange aria-hidden />
        {chosen?.label ?? "Quick dates"}
        <ChevronDown className="opacity-60" aria-hidden />
      </Button>
    </PopoverTrigger>
  );
}
