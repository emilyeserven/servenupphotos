import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * A (?) button after a row of the map's key, which opens a short explanation beside it. It opens on
 * a click or tap rather than on hover, so it works on phones too.
 */
export function LegendHelp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`About ${label}`}
        className="-my-1 ml-auto rounded-full p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CircleHelp className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="flex w-64 flex-col gap-2 p-3 text-sm">
        {children}
      </PopoverContent>
    </Popover>
  );
}
