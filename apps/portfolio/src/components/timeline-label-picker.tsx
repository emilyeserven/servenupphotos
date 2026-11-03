import { ChevronDown, Tag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { allTimelineLabels, labelDates, type TimelineLabel } from "@/lib/timeline-labels";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

/** A label's days, such as "Sep 22 – Oct 2, 2026". */
function labelDays(label: TimelineLabel): string {
  const { start, end } = labelDates(label);
  if (label.start === label.end) return format(start, "MMM d, yyyy");
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

/**
 * The Timeline's label picker: shows only the photos of one timeline label's days, such as a
 * trip, or every label's with "Any days". Nothing when there are no labels.
 */
export function TimelineLabelPicker({
  value,
  onChange,
}: {
  /** The chosen label, or undefined for none. */
  value?: TimelineLabel;
  onChange: (id: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const labels = allTimelineLabels();
  if (labels.length === 0) return null;

  function choose(id: string | undefined) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PickerButton value={value} />
      <PopoverContent align="start" className="flex w-64 flex-col gap-0.5 p-1">
        <LabelChoice active={!value} onClick={() => choose(undefined)} name="Any label" />
        {labels.map((label) => (
          <LabelChoice
            key={label.id}
            active={value?.id === label.id}
            onClick={() => choose(label.id)}
            name={label.name}
            days={labelDays(label)}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** The button that opens the picker, naming the chosen label. */
function PickerButton({ value }: { value?: TimelineLabel }) {
  return (
    <PopoverTrigger asChild>
      <Button variant="outline" className={cn("justify-between gap-2", value && "bg-muted")}>
        <Tag aria-hidden />
        {value?.name ?? "Any label"}
        <ChevronDown className="opacity-60" aria-hidden />
      </Button>
    </PopoverTrigger>
  );
}

/** One label to pick, with its days. */
function LabelChoice({
  active,
  onClick,
  name,
  days,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  days?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-muted font-medium",
      )}
    >
      {name}
      {days && <span className="text-xs font-normal text-muted-foreground">{days}</span>}
    </button>
  );
}
