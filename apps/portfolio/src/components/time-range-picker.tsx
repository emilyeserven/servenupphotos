import { format } from "date-fns";
import { CalendarClock, CalendarIcon, ChevronDown } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  activeQuickRange,
  describeTimeRange,
  type QuickRangeKey,
  quickRanges,
  type TimeRangeValue,
} from "@/lib/time-range";

/** A dropdown of Grafana-style quick ranges. Shows the exact dates when a custom range is set. */
export function QuickRangeSelect({
  value,
  onChange,
}: {
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-56 justify-between">
          <span className="flex items-center gap-2">
            <CalendarClock aria-hidden />
            {describeTimeRange(value)}
          </span>
          <ChevronDown className="opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuRadioGroup
          value={activeQuickRange(value) ?? ""}
          onValueChange={(key) => onChange(key === "all" ? {} : { range: key as QuickRangeKey })}
        >
          {(Object.keys(quickRanges) as QuickRangeKey[]).map((key) => (
            <DropdownMenuRadioItem key={key} value={key}>
              {quickRanges[key].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * From/To date pickers for picking specific dates. They always show the range currently in view,
 * so they follow the quick range dropdown and chart selections too.
 */
export function DateRangeFields({
  start,
  end,
  onChange,
}: {
  start: Date;
  end: Date;
  onChange: (from: Date, to: Date) => void;
}) {
  // Captured once so the calendars' "no future dates" rule doesn't call Date during render.
  const [today] = useState(() => new Date());

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <DateField
        label="From"
        value={start}
        disabled={{ after: end }}
        onSelect={(from) => onChange(from, end)}
      />
      <DateField
        label="To"
        value={end}
        disabled={[{ before: start }, { after: today }]}
        onSelect={(to) => onChange(start, to)}
      />
    </div>
  );
}

function DateField({
  label,
  value,
  disabled,
  onSelect,
}: {
  label: string;
  value: Date;
  disabled: ComponentProps<typeof Calendar>["disabled"];
  onSelect: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);

  function select(date: Date | undefined) {
    setOpen(false);
    if (date) onSelect(date);
  }

  return (
    <label className="flex items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="min-w-36 justify-start font-normal">
            <CalendarIcon className="opacity-60" aria-hidden />
            {format(value, "MMM d, yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            required
            selected={value}
            defaultMonth={value}
            onSelect={select}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    </label>
  );
}
