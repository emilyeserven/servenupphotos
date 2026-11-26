import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useRef,
} from "react";
import { type Overlay, CropOverlays } from "@/components/thumbnail-crop/crop-overlays";
import { type Corner, type Crop, type Size, cropText, keyedCrop, moved, resized } from "@/lib/crop";
import { cn } from "@/lib/utils";

/** A crop on a photo whose size is known, so it can be drawn. */
export interface Placed {
  /** The photo's size, turned upright, in its pixels. */
  photo: Size;
  /** The square on the photo, in its pixels. */
  crop: Crop;
}

/** The crop on the photo, once both are known. */
export function placement(photo: Size | null, crop: Crop | null): Placed | null {
  return photo && crop ? { photo, crop } : null;
}

// The handles sit just inside the square's corners, so the photo's edge never clips them.
const CORNERS: (Corner & { className: string; label: string })[] = [
  { dx: -1, dy: -1, className: "top-1 left-1 cursor-nwse-resize", label: "top left" },
  { dx: 1, dy: -1, className: "top-1 right-1 cursor-nesw-resize", label: "top right" },
  { dx: -1, dy: 1, className: "bottom-1 left-1 cursor-nesw-resize", label: "bottom left" },
  { dx: 1, dy: 1, className: "right-1 bottom-1 cursor-nwse-resize", label: "bottom right" },
];

interface CropFrameProps {
  src: string;
  children: ReactNode;
}

/** The photo, shrunk to fit, with the crop box laid over it in percentages of its size. */
export function CropFrame({ src, children }: CropFrameProps) {
  return (
    <div className="relative mx-auto w-fit touch-none overflow-hidden rounded-lg border">
      <img
        src={src}
        alt="The chosen photo"
        draggable={false}
        className="block max-h-96 max-w-full select-none"
      />
      {children}
    </div>
  );
}

interface CropBoxProps {
  placed: Placed;
  locked: boolean;
  overlays: Overlay[];
  onCropChange: (crop: Crop) => void;
}

/** Where a crop sits on the photo, in percentages of the photo's displayed size. */
function boxStyle({ photo, crop }: Placed) {
  return {
    left: `${(crop.x / photo.width) * 100}%`,
    top: `${(crop.y / photo.height) * 100}%`,
    width: `${(crop.size / photo.width) * 100}%`,
    height: `${(crop.size / photo.height) * 100}%`,
  };
}

/** The square over the photo, dimming everything outside it. */
const BOX_CLASS =
  "absolute border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.5)] outline-none";

export function CropBox({ placed, locked, overlays, onCropChange }: CropBoxProps) {
  if (locked) {
    return (
      <div aria-hidden style={boxStyle(placed)} className={BOX_CLASS}>
        <CropOverlays overlays={overlays} />
      </div>
    );
  }
  return <EditableCropBox placed={placed} overlays={overlays} onCropChange={onCropChange} />;
}

/** What a drag under way started from. */
interface Drag {
  /** The corner being dragged, or none when moving the whole square. */
  corner?: Corner;
  pointerX: number;
  pointerY: number;
  start: Crop;
  /** Photo pixels per screen pixel. */
  scale: number;
}

/** Moves the crop when its square is dragged, and resizes it when a corner is. */
function useCropDrag(
  box: RefObject<HTMLDivElement | null>,
  { photo, crop }: Placed,
  onCropChange: (crop: Crop) => void,
) {
  const drag = useRef<Drag | null>(null);

  const start = (event: PointerEvent<HTMLElement>, corner?: Corner) => {
    if (!box.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const scale = crop.size / box.current.clientWidth;
    drag.current = { corner, pointerX: event.clientX, pointerY: event.clientY, start: crop, scale };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current) return;
    const dx = (event.clientX - current.pointerX) * current.scale;
    const dy = (event.clientY - current.pointerY) * current.scale;
    onCropChange(
      current.corner
        ? resized(current.start, current.corner, dx, dy, photo)
        : moved(current.start, dx, dy, photo),
    );
  };
  const end = () => {
    drag.current = null;
  };
  return { start, handlers: { onPointerMove: move, onPointerUp: end, onPointerCancel: end } };
}

function EditableCropBox({ placed, overlays, onCropChange }: Omit<CropBoxProps, "locked">) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useCropDrag(box, placed, onCropChange);
  const { photo, crop } = placed;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = keyedCrop(event.key, event.shiftKey, crop, photo);
    if (!next) return;
    event.preventDefault();
    onCropChange(next);
  };

  return (
    <div
      ref={box}
      role="slider"
      tabIndex={0}
      aria-label="Square Thumbnail crop"
      aria-valuetext={cropText(crop)}
      aria-valuemin={0}
      aria-valuemax={photo.width - crop.size}
      aria-valuenow={Math.round(crop.x)}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => drag.start(event)}
      {...drag.handlers}
      style={boxStyle(placed)}
      className={cn(BOX_CLASS, "focus-visible:ring-ring cursor-move focus-visible:ring-[3px]")}
    >
      <CropOverlays overlays={overlays} />
      {CORNERS.map((corner) => (
        <span
          key={corner.label}
          aria-hidden
          onPointerDown={(event) => drag.start(event, corner)}
          {...drag.handlers}
          className={cn(
            "absolute size-3.5 rounded-full border border-black/40 bg-white shadow-sm",
            corner.className,
          )}
        />
      ))}
    </div>
  );
}
