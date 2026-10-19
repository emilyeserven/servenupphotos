import { RotateCcwIcon } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { THUMBNAIL } from "@/api/versions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useObjectUrl } from "@/hooks/use-object-url";
import {
  type Corner,
  type Crop,
  type Size,
  centerCrop,
  cropText,
  keyedCrop,
  moved,
  resized,
  sameCrop,
} from "@/lib/crop";
import { cn } from "@/lib/utils";

// The handles sit just inside the square's corners, so the photo's edge never clips them.
const CORNERS: (Corner & { className: string; label: string })[] = [
  { dx: -1, dy: -1, className: "top-1 left-1 cursor-nwse-resize", label: "top left" },
  { dx: 1, dy: -1, className: "top-1 right-1 cursor-nesw-resize", label: "top right" },
  { dx: -1, dy: 1, className: "bottom-1 left-1 cursor-nesw-resize", label: "bottom left" },
  { dx: 1, dy: 1, className: "right-1 bottom-1 cursor-nwse-resize", label: "bottom right" },
];

interface ThumbnailCropProps {
  photo: File;
  crop: Crop | null;
  onCropChange: (crop: Crop) => void;
  /** The photo is being uploaded or already was, with this crop, so it can't change. */
  locked: boolean;
}

/**
 * Picks the square of photo its thumbnail is cut from, starting from the middle, with a preview of
 * the thumbnail as the upload will make it.
 */
export function ThumbnailCrop({ photo, ...editor }: ThumbnailCropProps) {
  const [url, setFile] = useObjectUrl();
  useEffect(() => setFile(photo), [photo, setFile]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Square thumbnail</CardTitle>
        <CardDescription>
          Drag the square to pick the part of the photo used where every photo is a square tile,
          like the portfolio's Grid, and drag a corner to resize it. Uploading turns it into a{" "}
          {THUMBNAIL.maxEdge} × {THUMBNAIL.maxEdge} px WEBP, whatever its size here.
        </CardDescription>
      </CardHeader>
      <CardContent>{url && <CropEditor src={url} {...editor} />}</CardContent>
    </Card>
  );
}

/** A crop on a photo whose size is known, so it can be drawn. */
interface Placed {
  photo: Size;
  crop: Crop;
}

function placement(photo: Size | null, crop: Crop | null): Placed | null {
  return photo && crop ? { photo, crop } : null;
}

type CropEditorProps = Omit<ThumbnailCropProps, "photo"> & { src: string };

/** The photo with the crop over it, then the thumbnail it makes. */
function CropEditor({ src, crop, onCropChange, locked }: CropEditorProps) {
  const [photo, setPhoto] = useState<Size | null>(null);
  // The crop starts in the middle once the photo's size is known.
  const onLoad = (loaded: Size) => {
    setPhoto(loaded);
    if (!crop) onCropChange(centerCrop(loaded));
  };
  const placed = placement(photo, crop);

  return (
    <div className="flex flex-col gap-4">
      <CropFrame src={src} onLoad={onLoad}>
        {placed && <CropBox placed={placed} locked={locked} onCropChange={onCropChange} />}
      </CropFrame>
      <CropSummary src={src} placed={placed} locked={locked} onCropChange={onCropChange} />
    </div>
  );
}

interface CropFrameProps {
  src: string;
  onLoad: (size: Size) => void;
  children: ReactNode;
}

/** The photo, shrunk to fit, with the crop box laid over it in percentages of its size. */
function CropFrame({ src, onLoad, children }: CropFrameProps) {
  return (
    <div className="relative mx-auto w-fit touch-none overflow-hidden rounded-lg border">
      <img
        src={src}
        alt="The chosen photo"
        draggable={false}
        onLoad={({ currentTarget: image }) =>
          // Browsers report the size of a photo turned upright from its EXIF orientation.
          onLoad({ width: image.naturalWidth, height: image.naturalHeight })
        }
        className="block max-h-96 max-w-full select-none"
      />
      {children}
    </div>
  );
}

interface CropBoxProps {
  placed: Placed;
  locked: boolean;
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

function CropBox({ placed, locked, onCropChange }: CropBoxProps) {
  if (locked) return <div aria-hidden style={boxStyle(placed)} className={BOX_CLASS} />;
  return <EditableCropBox placed={placed} onCropChange={onCropChange} />;
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

function EditableCropBox({ placed, onCropChange }: Omit<CropBoxProps, "locked">) {
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
      aria-label="Thumbnail crop"
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

interface CropSummaryProps {
  src: string;
  placed: Placed | null;
  locked: boolean;
  onCropChange: (crop: Crop) => void;
}

/** The thumbnail as the upload will make it, where it's cut from, and how to change it. */
function CropSummary({ src, placed, locked, onCropChange }: CropSummaryProps) {
  if (!placed) return null;
  const { crop } = placed;
  return (
    <div className="flex flex-wrap items-start gap-4">
      <ThumbnailPreview src={src} placed={placed} />
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
        <p>
          <span className="font-medium">
            {THUMBNAIL.maxEdge} × {THUMBNAIL.maxEdge} px
          </span>{" "}
          <span className="text-muted-foreground">from {cropText(crop)}.</span>
        </p>
        {crop.size < THUMBNAIL.maxEdge && (
          <p className="text-muted-foreground">
            The square is smaller than {THUMBNAIL.maxEdge} px, so it's scaled up and may look soft.
          </p>
        )}
        <CropControls placed={placed} locked={locked} onCropChange={onCropChange} />
      </div>
    </div>
  );
}

interface CropControlsProps {
  placed: Placed;
  locked: boolean;
  onCropChange: (crop: Crop) => void;
}

/** How to change the crop, and a way back to the middle, or that it can't change anymore. */
function CropControls({ placed, locked, onCropChange }: CropControlsProps) {
  if (locked) {
    return (
      <p className="text-muted-foreground">
        The thumbnail is uploaded with this square. Choose the photo again to pick another.
      </p>
    );
  }
  const middle = centerCrop(placed.photo);
  return (
    <>
      <p className="text-muted-foreground">
        Arrow keys move the focused square (Shift for bigger steps), and + and − resize it.
      </p>
      {!sameCrop(placed.crop, middle) && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onCropChange(middle)}
        >
          <RotateCcwIcon />
          Back to the middle
        </Button>
      )}
    </>
  );
}

/** The crop scaled into a square, as the thumbnail will show it. */
function ThumbnailPreview({ src, placed: { photo, crop } }: { src: string; placed: Placed }) {
  return (
    <figure className="flex flex-col gap-1.5">
      {/* A square, so percentages of its width and height scale the photo the same way. */}
      <div className="bg-muted relative size-40 overflow-hidden rounded-md border">
        <img
          src={src}
          alt="Preview of the square thumbnail"
          draggable={false}
          className="absolute max-w-none"
          style={{
            left: `${(-crop.x / crop.size) * 100}%`,
            top: `${(-crop.y / crop.size) * 100}%`,
            width: `${(photo.width / crop.size) * 100}%`,
            height: `${(photo.height / crop.size) * 100}%`,
          }}
        />
      </div>
      <figcaption className="text-muted-foreground text-xs">Thumbnail preview</figcaption>
    </figure>
  );
}
