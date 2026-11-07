import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { ChoiceRow } from "@portfolio/components/choice-row";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";
import { cn } from "@portfolio/lib/utils";

/** The name of the choice with the ID. */
function nameOf<T extends string>(options: [T, string][], value: T): string {
  return options.find(([id]) => id === value)?.[1] ?? "";
}

/** Whether the value isn't the first choice, the default. */
function isChanged<T extends string>(options: [T, string][], value: T): boolean {
  return options.findIndex(([id]) => id === value) > 0;
}

/**
 * A small button naming what it changes, such as **Group by**, with its icon, that opens a menu of
 * its choices, the current one checked; pressed-looking while it isn't the first, the default.
 * None with fewer than two choices.
 */
export function PickMenu<T extends string>({
  label,
  Icon,
  options,
  value,
  onChange,
}: {
  label: string;
  Icon: LucideIcon;
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  if (options.length < 2) return null;
  const current = nameOf(options, value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${label}: ${current}`}
          title={`${label}: ${current}`}
          className={cn(
            "h-7 gap-1 px-2 text-xs font-normal text-muted-foreground",
            isChanged(options, value) && "bg-accent text-foreground",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-44 flex-col p-1">
        {options.map(([id, name]) => (
          <ChoiceRow
            key={id}
            label={name}
            on={id === value}
            onClick={() => {
              onChange(id);
              setOpen(false);
            }}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}
