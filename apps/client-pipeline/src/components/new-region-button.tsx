import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { RegionIcon } from "@/components/region-icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { RegionKind } from "@/lib/region-tree";

/** What the menu adds, in the order it lists them. */
const CHOICES: { kind: RegionKind; label: string }[] = [
  { kind: "place", label: "Place" },
  { kind: "city", label: "City" },
  { kind: "state", label: "State" },
  { kind: "country", label: "Country" },
];

/** **New**, which opens a menu to add a place, city, state or country in the edit panel. */
export function NewRegionButton({ onNew }: { onNew: (kind: RegionKind) => void }) {
  const [open, setOpen] = useState(false);
  const choose = (kind: RegionKind) => {
    setOpen(false);
    onNew(kind);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm">
          <PlusIcon />
          New
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-40 flex-col p-1">
        {CHOICES.map(({ kind, label }) => (
          <Button
            key={kind}
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => choose(kind)}
          >
            <RegionIcon kind={kind} />
            {label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
