import { Eye } from "lucide-react";
import { PinSizeControl } from "@/components/pin-size-control";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PinScale } from "@/lib/pin-scale";

/** The Color page's **Display** menu, with how big the photo previews are. */
export function ColorDisplayMenu({ pins }: { pins?: PinScale }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye aria-hidden />
          Display
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-auto flex-col gap-2 p-3">
        <span className="text-xs font-medium text-muted-foreground">Preview size</span>
        <PinSizeControl scale={pins} />
      </PopoverContent>
    </Popover>
  );
}
