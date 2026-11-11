import { CropIcon, RotateCcwIcon } from "lucide-react";
import { type PointerEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  type OriginalCrop,
  type Size,
  middleCrop,
  movedCrop,
  resizedCrop,
} from "@/lib/unedited-original";

interface OriginalCropPickerProps {
  /** A version of the original to draw on. */
  src: string;
  /** The original's size in pixels, which the crop is measured in. */
  size: Size;
  /** The edit's size, whose shape the crop keeps. */
  edit: Size;
  /** The crop saved, or the middle part in the edit's shape before one is. */
  saved: OriginalCrop;
  /** Whether a crop is saved in the JSON yet. */
  isSaved: boolean;
  onSave: (crop: OriginalCrop) => void;
  saving: boolean;
  disabled: boolean;
}

/** What a press on the picker drags: the crop itself, or its bottom-right corner. */
interface Drag {
  kind: "move" | "resize";
  /** Where the press started, in screen pixels. */
  x: number;
  y: number;
  /** The crop when it started. */
  start: OriginalCrop;
}

/**
 * The part of the unedited original the edit shows, for an edit that was cropped: a box in the
 * edit's shape over the original, dragged to move it and by its corner to size it. The Slider and
 * Switch draw only this part, so the two line up.
 */
export function OriginalCropPicker(props: OriginalCropPickerProps) {
  const { src, size, saved, disabled } = props;
  const [crop, setCrop] = useState(saved);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  /** Screen pixels to the original's pixels. */
  const scale = () => size.width / (frame.current?.clientWidth || size.width);

  const begin = (kind: Drag["kind"]) => (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { kind, x: event.clientX, y: event.clientY, start: crop };
  };
  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const now = drag.current;
    if (!now) return;
    const dx = (event.clientX - now.x) * scale();
    const dy = (event.clientY - now.y) * scale();
    setCrop(
      now.kind === "move" ? movedCrop(now.start, dx, dy, size) : resizedCrop(now.start, dx, size),
    );
  };
  const end = () => {
    drag.current = null;
  };
  const percent = (value: number, of: number) => `${(value / of) * 100}%`;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={frame}
        className="relative mx-auto w-full touch-none overflow-hidden rounded-md select-none"
        style={{
          aspectRatio: `${size.width / size.height}`,
          maxWidth: `calc(28rem * ${size.width / size.height})`,
        }}
      >
        <img src={src} alt="The unedited original" draggable={false} className="size-full" />
        <div
          role="presentation"
          onPointerDown={begin("move")}
          onPointerMove={follow}
          onPointerUp={end}
          className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.5)]"
          style={{
            left: percent(crop.x, size.width),
            top: percent(crop.y, size.height),
            width: percent(crop.width, size.width),
            height: percent(crop.height, size.height),
          }}
        >
          <div
            role="presentation"
            onPointerDown={begin("resize")}
            onPointerMove={follow}
            onPointerUp={end}
            className="absolute -right-2 -bottom-2 size-4 cursor-nwse-resize rounded-sm border-2 border-white bg-black/60"
          />
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        {crop.width} × {crop.height} px from {crop.x}, {crop.y}.
      </p>
      <CropButtons {...props} crop={crop} setCrop={setCrop} />
    </div>
  );
}

/** Puts the crop back to the saved one, once it's moved. */
function UndoCrop({
  shown,
  disabled,
  onUndo,
}: {
  shown: boolean;
  disabled: boolean;
  onUndo: () => void;
}) {
  if (!shown) return null;
  return (
    <Button variant="outline" size="sm" disabled={disabled} onClick={onUndo}>
      <RotateCcwIcon />
      Undo
    </Button>
  );
}

function SaveIcon({ saving }: { saving: boolean }) {
  return saving ? <Spinner /> : <CropIcon />;
}

/** Saves the crop, or starts it over from the saved one or the middle. */
function CropButtons({
  size,
  edit,
  saved,
  isSaved,
  onSave,
  saving,
  disabled,
  crop,
  setCrop,
}: OriginalCropPickerProps & { crop: OriginalCrop; setCrop: (crop: OriginalCrop) => void }) {
  const changed = JSON.stringify(crop) !== JSON.stringify(saved);
  // A crop that's only the starting one can be saved as it is.
  const unsaveable = disabled || (!changed && isSaved);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={unsaveable} onClick={() => onSave(crop)}>
        <SaveIcon saving={saving} />
        Save crop
      </Button>
      <UndoCrop shown={changed} disabled={disabled} onUndo={() => setCrop(saved)} />
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setCrop(middleCrop(size, edit))}
      >
        Largest in the middle
      </Button>
    </div>
  );
}
