import { Minus, Plus } from "lucide-react";
import type { BulkCrop } from "@/components/gear-pictures/use-bulk-crop";
import type { GearCrop } from "@portfolio/lib/gear-pictures";
import { Button } from "@/components/ui/button";
import { wholeCrop, zoomCrop, zoomOf } from "@/lib/gear-crop";

/** How much one press of − or + zooms, as a power of two. */
const ZOOM_STEP = 0.1;

/** A crop zoomed by `step` powers of two. */
const zoomBy = (step: number) => (crop: GearCrop) => zoomCrop(crop, zoomOf(crop) + step);

/**
 * How far the slider goes, around the edited picture's whole-picture zoom, so a picture of any
 * shape can be zoomed well in to its gear or out to room around it.
 */
function rangeOf(bulk: BulkCrop): { min: number; max: number } {
  const lead = bulk.current;
  const size = lead && bulk.sizes[lead.file.id];
  const whole = size ? zoomOf(wholeCrop(...size)) : 0;
  return { min: whole - 3, max: whole + 5 };
}

/**
 * The zoom slider, with − and + at its ends, zooming only the picture being edited (not every
 * chosen one), and off until one is.
 */
export function CropZoom({ bulk }: { bulk: BulkCrop }) {
  const lead = bulk.current;
  const value = lead?.crop ? zoomOf(lead.crop) : 0;
  const zoom = (step: number) => bulk.changeCurrent(zoomBy(step));
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground mr-1">Zoom</span>
      <Button
        variant="outline"
        size="icon"
        className="size-7"
        aria-label="Zoom out"
        disabled={!lead}
        onClick={() => zoom(-ZOOM_STEP)}
      >
        <Minus />
      </Button>
      <input
        type="range"
        aria-label="Zoom"
        {...rangeOf(bulk)}
        step={0.01}
        value={value}
        disabled={!lead}
        className="accent-primary w-40"
        onChange={(e) => zoom(Number(e.target.value) - value)}
      />
      <Button
        variant="outline"
        size="icon"
        className="size-7"
        aria-label="Zoom in"
        disabled={!lead}
        onClick={() => zoom(ZOOM_STEP)}
      >
        <Plus />
      </Button>
    </div>
  );
}
