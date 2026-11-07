import { Minus, Plus } from "lucide-react";
import type { BulkCrop, CropEntry } from "@/components/gear-pictures/use-bulk-crop";
import { Button } from "@/components/ui/button";
import { wholeCrop, zoomCrop, zoomOf } from "@/lib/gear-crop";

/** How much one press of − or + zooms, as a power of two. */
const ZOOM_STEP = 0.1;

/** The chosen pictures' crop zoomed by `step` powers of two. */
const zoomBy = (step: number) => (entry: CropEntry) =>
  entry.crop && zoomCrop(entry.crop, zoomOf(entry.crop) + step);

/** The first chosen picture with a crop, which the slider shows the zoom of. */
function leadOf(bulk: BulkCrop): CropEntry | undefined {
  return bulk.entries.find((entry) => entry.crop && bulk.chosen.has(entry.file.id));
}

/**
 * How far the slider goes, around the lead picture's whole-picture zoom, so a picture of any
 * shape can be zoomed well in to its gear or out to room around it.
 */
function rangeOf(bulk: BulkCrop, lead?: CropEntry): { min: number; max: number } {
  const size = lead && bulk.sizes[lead.file.id];
  const whole = size ? zoomOf(wholeCrop(...size)) : 0;
  return { min: whole - 3, max: whole + 5 };
}

/**
 * The zoom slider, with − and + at its ends, zooming every chosen picture together. The slider
 * shows the first chosen picture's zoom; moving it zooms each chosen picture by the same amount,
 * so pictures already lined up stay lined up.
 */
export function CropZoom({ bulk }: { bulk: BulkCrop }) {
  const lead = leadOf(bulk);
  const value = lead?.crop ? zoomOf(lead.crop) : 0;
  const zoom = (step: number) => bulk.change(zoomBy(step));
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
        {...rangeOf(bulk, lead)}
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
