import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { GearCrop, GearFile } from "@portfolio/lib/gear-pictures";
import { cropGearImageMutation, saveGearMutation } from "@/api/gear";
import { Busy, SaveNote } from "@/components/entry-buttons";
import { cropLimits } from "@/components/gear-pictures/crop-limits";
import type { BulkCrop, CropEntry } from "@/components/gear-pictures/use-bulk-crop";
import { Button } from "@/components/ui/button";
import { fitCrop, wholeCrop, zoomCrop, zoomOf } from "@/lib/gear-crop";

/** How much one press of a zoom button zooms, as a power of two. */
const ZOOM_STEP = 0.1;

/** The chosen pictures' crop zoomed by `step` powers of two. */
const zoomBy = (step: number) => (entry: CropEntry) =>
  entry.crop && zoomCrop(entry.crop, zoomOf(entry.crop) + step);

/** The crop that fits the picture's gear inside the limit lines, when its gear was found. */
const fitted = (sizes: BulkCrop["sizes"]) => (entry: CropEntry) => {
  const size = sizes[entry.file.id];
  const subject = entry.file.subject;
  return size && subject && fitCrop(subject, size, cropLimits.get(), entry.crop?.fill);
};

/** The crop that shows the whole picture, centered. */
const whole = (sizes: BulkCrop["sizes"]) => (entry: CropEntry) => {
  const size = sizes[entry.file.id];
  return size && wholeCrop(...size, entry.crop?.fill);
};

/** The crop with `fill` around the picture. */
const filled = (fill: GearCrop["fill"]) => (entry: CropEntry) =>
  entry.crop && { ...entry.crop, fill };

interface CropActionsProps {
  bulk: BulkCrop;
  overlay: number;
  onOverlay: (overlay: number) => void;
}

/**
 * What can be done to every chosen picture at once: zoom out or in, fit its gear inside the limit
 * lines, show it whole, fill around it with white or nothing, or put its crop back as saved; and
 * how faint the pictures not chosen are.
 */
export function CropActions({ bulk, overlay, onOverlay }: CropActionsProps) {
  const none = bulk.chosen.size === 0;
  const act = (label: string, change: (entry: CropEntry) => GearCrop | undefined) => (
    <Button variant="outline" size="sm" disabled={none} onClick={() => bulk.change(change)}>
      {label}
    </Button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {act("Zoom out", zoomBy(-ZOOM_STEP))}
      {act("Zoom in", zoomBy(ZOOM_STEP))}
      {act("Fit to limits", fitted(bulk.sizes))}
      {act("Whole picture", whole(bulk.sizes))}
      {act("White fill", filled("white"))}
      {act("Transparent fill", filled(undefined))}
      <Button variant="ghost" size="sm" disabled={none} onClick={bulk.reset}>
        Reset
      </Button>
      <label className="ml-2 flex items-center gap-2">
        <span className="text-muted-foreground">Others</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={overlay}
          className="accent-primary w-24"
          onChange={(e) => onOverlay(Number(e.target.value))}
        />
      </label>
    </div>
  );
}

/** The file a changed picture saves: its new crop cut, and the original it was cut from. */
function croppedFile(entry: CropEntry, image: string): GearFile {
  return { ...entry.file, image, original: entry.original, crop: entry.crop };
}

/** "1 crop" or "3 crops". */
function cropsText(count: number): string {
  return `${count} ${count === 1 ? "crop" : "crops"}`;
}

/**
 * Cuts every changed crop, chosen or not, into its 200px-tall WEBP and saves its file, one after
 * another, each a change waiting for Commit.
 */
export function SaveCrops({ bulk }: { bulk: BulkCrop }) {
  const cut = useMutation(cropGearImageMutation);
  const save = useMutation(saveGearMutation);
  const [done, setDone] = useState(0);
  const changed = bulk.entries.filter((entry) => entry.changed && entry.crop);
  const run = useMutation({
    mutationFn: async (entries: CropEntry[]) => {
      setDone(0);
      for (const entry of entries) {
        const crop = entry.crop as GearCrop;
        const res = await cut.mutateAsync({ original: entry.original, crop });
        await save.mutateAsync(croppedFile(entry, res.url));
        setDone((n) => n + 1);
      }
    },
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled={changed.length === 0 || run.isPending} onClick={() => run.mutate(changed)}>
        <Busy busy={run.isPending} />
        {run.isPending
          ? `Cutting ${done + 1} of ${changed.length}…`
          : `Cut and save ${cropsText(changed.length)}`}
      </Button>
      <SaveNote error={run.error} why="" />
    </div>
  );
}
