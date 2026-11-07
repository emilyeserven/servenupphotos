import { type PointerEvent, useRef, useState } from "react";
import type { GearFile, GearKind } from "@portfolio/lib/gear-pictures";
import { CropActions, SaveCrops } from "@/components/gear-pictures/crop-actions";
import { CropLimitFields, CropLimitLines } from "@/components/gear-pictures/crop-limits";
import {
  type BulkCrop,
  type CropEntry,
  useBulkCrop,
} from "@/components/gear-pictures/use-bulk-crop";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cropStyle, moveCrop, wholeCrop } from "@/lib/gear-crop";
import { cn } from "@/lib/utils";

/** A checkerboard, so a transparent background shows as one. */
const CHECKER = {
  backgroundImage: "conic-gradient(#e5e5e5 25%, #fff 0 50%, #e5e5e5 0 75%, #fff 0)",
  backgroundSize: "16px 16px",
};

/** How opaque a chosen picture is: mostly, so the others still show through it a little. */
const CHOSEN_OPACITY = 0.85;

/** What the card is called, by the kind of gear it crops. */
const TITLES: Record<GearKind, string> = { camera: "Camera crops", lens: "Lens crops" };

/**
 * Lines up every camera's (or lens's) crop at once, the normalizer for pictures that come in any
 * size and shape: one frame the shape of the 267 × 200 crop the portfolio shows, with every
 * picture drawn in it, faint. Choosing pictures unfades them, and dragging, zooming, fitting and
 * filling change all the chosen ones together. **Cut and save** cuts every changed crop and saves
 * its file, each a change waiting for Commit.
 */
export function GearCropCard({ kind, files }: { kind: GearKind; files: GearFile[] }) {
  const bulk = useBulkCrop(files);
  const [overlay, setOverlay] = useState(0.3);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLES[kind]}</CardTitle>
        <CardDescription>
          Every picture drawn in one frame, so each gets the same size and place. Choose pictures to
          unfade them; dragging, zooming, fitting and filling change all the chosen ones.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {bulk.entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">No picture to crop yet.</p>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex flex-col gap-3">
              <CropFrame bulk={bulk} overlay={overlay} />
              <CropActions bulk={bulk} overlay={overlay} onOverlay={setOverlay} />
              <CropLimitFields />
              <SaveCrops bulk={bulk} />
            </div>
            <CropPicks bulk={bulk} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** The frame: every picture placed by its crop, the chosen ones unfaded on top, and guide lines. */
function CropFrame({ bulk, overlay }: { bulk: BulkCrop; overlay: number }) {
  const drag = useDrag(bulk);
  return (
    <div
      {...drag}
      className="relative aspect-[267/200] w-full max-w-[640px] cursor-grab touch-none overflow-hidden rounded-md border select-none active:cursor-grabbing"
      style={CHECKER}
    >
      {bulk.entries.map((entry) => (
        <FramedPicture
          key={entry.file.id}
          entry={entry}
          bulk={bulk}
          chosen={bulk.chosen.has(entry.file.id)}
          opacity={bulk.chosen.has(entry.file.id) ? CHOSEN_OPACITY : overlay}
        />
      ))}
      <CenterLines />
      <CropLimitLines />
    </div>
  );
}

/** One picture in the frame; one from before crops gets the whole picture once it loads. */
function FramedPicture({
  entry,
  bulk,
  chosen,
  opacity,
}: {
  entry: CropEntry;
  bulk: BulkCrop;
  chosen: boolean;
  opacity: number;
}) {
  const { file, original, crop } = entry;
  const placed = crop ? cropStyle(crop) : { visibility: "hidden" as const };
  return (
    <img
      src={original}
      alt=""
      draggable={false}
      className="pointer-events-none"
      style={{ ...placed, opacity, zIndex: Number(chosen) }}
      onLoad={(e) => {
        const size: [number, number] = [
          e.currentTarget.naturalWidth,
          e.currentTarget.naturalHeight,
        ];
        bulk.sized(file.id, size);
        if (!crop) bulk.set(file.id, wholeCrop(...size));
      }}
    />
  );
}

/** Dashed lines across the frame's middle, to line pictures up by. */
function CenterLines() {
  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 border-l border-dashed border-sky-500/60" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 border-t border-dashed border-sky-500/60" />
    </>
  );
}

/** Pointer handlers that move every chosen picture as the frame is dragged. */
function useDrag(bulk: BulkCrop) {
  const last = useRef<{ x: number; y: number }>(undefined);
  return {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      last.current = { x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (!last.current) return;
      const box = e.currentTarget.getBoundingClientRect();
      const dx = (e.clientX - last.current.x) / box.width;
      const dy = (e.clientY - last.current.y) / box.height;
      bulk.change(({ crop }) => crop && moveCrop(crop, dx, dy));
      last.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: () => {
      last.current = undefined;
    },
  };
}

/** The pictures to choose from, with All and None, and a mark on each whose crop has changed. */
function CropPicks({ bulk }: { bulk: BulkCrop }) {
  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <legend className="sr-only">Pictures to crop</legend>
      <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
        <span className="mr-auto">{bulk.chosen.size} chosen</span>
        <button type="button" className="hover:underline" onClick={() => bulk.chooseAll(true)}>
          All
        </button>
        <button type="button" className="hover:underline" onClick={() => bulk.chooseAll(false)}>
          None
        </button>
      </div>
      {bulk.entries.map((entry) => (
        <label
          key={entry.file.id}
          className={cn(
            "hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1",
            bulk.chosen.has(entry.file.id) && "bg-muted",
          )}
        >
          <input
            type="checkbox"
            className="accent-primary"
            checked={bulk.chosen.has(entry.file.id)}
            onChange={() => bulk.toggle(entry.file.id)}
          />
          <span className="min-w-0 flex-1 truncate">{entry.file.name}</span>
          {entry.changed && <span className="text-muted-foreground text-xs">changed</span>}
        </label>
      ))}
    </fieldset>
  );
}
