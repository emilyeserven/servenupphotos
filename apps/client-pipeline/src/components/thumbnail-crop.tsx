import { CrosshairIcon, GridIcon, HashIcon, RotateCcwIcon } from "lucide-react";
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
  /** The chosen photo, or the URL of one already in R2. */
  photo: File | string;
  crop: Crop | null;
  onCropChange: (crop: Crop) => void;
  /** The photo is being uploaded or already was, with this crop, so it can't change. */
  locked: boolean;
  /** What to say while it's locked. */
  lockedNote?: string;
}

/**
 * Picks the square of photo its thumbnail is cut from, starting from the middle, with a preview of
 * the thumbnail as the upload will make it.
 */
export function ThumbnailCrop({ photo, ...editor }: ThumbnailCropProps) {
  const [objectUrl, setFile] = useObjectUrl();
  useEffect(() => setFile(typeof photo === "string" ? null : photo), [photo, setFile]);
  const url = typeof photo === "string" ? photo : objectUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Square Thumbnail</CardTitle>
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
function CropEditor({ src, crop, onCropChange, locked, lockedNote }: CropEditorProps) {
  const [photo, setPhoto] = useState<Size | null>(null);
  // The crop starts in the middle once the photo's size is known.
  const onLoad = (loaded: Size) => {
    setPhoto(loaded);
    if (!crop) onCropChange(centerCrop(loaded));
  };
  const placed = placement(photo, crop);
  const [overlays, toggleOverlay] = useOverlays();

  return (
    <div className="flex flex-col gap-4">
      <CropFrame src={src} onLoad={onLoad}>
        {placed && (
          <CropBox
            placed={placed}
            locked={locked}
            overlays={overlays}
            onCropChange={onCropChange}
          />
        )}
      </CropFrame>
      {placed && <OverlayToggles overlays={overlays} onToggle={toggleOverlay} />}
      <CropSummary
        src={src}
        placed={placed}
        overlays={overlays}
        locked={locked}
        lockedNote={lockedNote}
        onCropChange={onCropChange}
      />
    </div>
  );
}

/** Guides drawn over the square to help compose it. */
type Overlay = "thirds" | "center" | "grid";

const OVERLAYS: { id: Overlay; label: string; Icon: typeof HashIcon }[] = [
  { id: "thirds", label: "Rule of thirds", Icon: HashIcon },
  { id: "center", label: "Center", Icon: CrosshairIcon },
  { id: "grid", label: "Grid", Icon: GridIcon },
];

/** How many cells a side of the grid overlay has. */
const GRID_CELLS = 6;

const OVERLAYS_KEY = "thumbnail-crop-overlays";

function storedOverlays(): Overlay[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(OVERLAYS_KEY) ?? "[]");
    return Array.isArray(stored)
      ? OVERLAYS.map(({ id }) => id).filter((id) => stored.includes(id))
      : [];
  } catch {
    return [];
  }
}

/** The overlays turned on, remembered in this browser so the next photo starts with them. */
function useOverlays() {
  const [overlays, setOverlays] = useState<Overlay[]>(storedOverlays);
  const toggle = (overlay: Overlay) =>
    setOverlays((current) => {
      const next = current.includes(overlay)
        ? current.filter((id) => id !== overlay)
        : [...current, overlay];
      try {
        localStorage.setItem(OVERLAYS_KEY, JSON.stringify(next));
      } catch {
        // Not remembered, but still shown.
      }
      return next;
    });
  return [overlays, toggle] as const;
}

interface OverlayTogglesProps {
  overlays: Overlay[];
  onToggle: (overlay: Overlay) => void;
}

/** Turns each overlay on the square and its preview on or off. */
function OverlayToggles({ overlays, onToggle }: OverlayTogglesProps) {
  return (
    <div role="group" aria-label="Overlays" className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-sm">Overlays</span>
      {OVERLAYS.map(({ id, label, Icon }) => {
        const shown = overlays.includes(id);
        return (
          <Button
            key={id}
            variant={shown ? "secondary" : "outline"}
            size="sm"
            aria-pressed={shown}
            onClick={() => onToggle(id)}
          >
            <Icon />
            {label}
          </Button>
        );
      })}
    </div>
  );
}

/** Where each overlay's lines fall, as fractions of the square's side. */
function overlayLines(overlays: Overlay[]) {
  const lines = new Set<number>();
  if (overlays.includes("grid")) {
    for (let i = 1; i < GRID_CELLS; i++) lines.add(i / GRID_CELLS);
  }
  if (overlays.includes("thirds")) {
    lines.add(1 / 3);
    lines.add(2 / 3);
  }
  return lines;
}

/** The overlays' lines, stretched over whatever square they sit in. */
function CropOverlays({ overlays }: { overlays: Overlay[] }) {
  if (overlays.length === 0) return null;
  const thirds = overlays.includes("thirds");
  // Grid lines are fainter than the thirds, so the thirds stand out when both are on.
  const lines = [...overlayLines(overlays)].map((at) => ({
    at: at * 100,
    strong: thirds && (Math.abs(at - 1 / 3) < 1e-9 || Math.abs(at - 2 / 3) < 1e-9),
  }));
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full overflow-visible drop-shadow-[0_0_1px_rgb(0_0_0/0.8)]"
    >
      {lines.map(({ at, strong }) => (
        <g
          key={at}
          stroke="white"
          strokeOpacity={strong ? 0.9 : 0.5}
          strokeWidth={strong ? 1.5 : 1}
          vectorEffect="non-scaling-stroke"
        >
          <line x1={at} y1={0} x2={at} y2={100} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={at} x2={100} y2={at} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      {overlays.includes("center") && (
        <g stroke="white" strokeWidth={1.5} strokeOpacity={0.9}>
          <line x1={46} y1={50} x2={54} y2={50} vectorEffect="non-scaling-stroke" />
          <line x1={50} y1={46} x2={50} y2={54} vectorEffect="non-scaling-stroke" />
        </g>
      )}
    </svg>
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

function CropBox({ placed, locked, overlays, onCropChange }: CropBoxProps) {
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

interface CropSummaryProps {
  src: string;
  placed: Placed | null;
  overlays: Overlay[];
  locked: boolean;
  lockedNote?: string;
  onCropChange: (crop: Crop) => void;
}

/** The thumbnail as the upload will make it, where it's cut from, and how to change it. */
function CropSummary({
  src,
  placed,
  overlays,
  locked,
  lockedNote,
  onCropChange,
}: CropSummaryProps) {
  if (!placed) return null;
  const { crop } = placed;
  return (
    <div className="flex flex-wrap items-start gap-4">
      <ThumbnailPreview src={src} placed={placed} overlays={overlays} />
      <div className="flex min-w-48 flex-1 flex-col gap-2 text-sm">
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
        <CropControls
          placed={placed}
          locked={locked}
          lockedNote={lockedNote}
          onCropChange={onCropChange}
        />
      </div>
    </div>
  );
}

interface CropControlsProps {
  placed: Placed;
  locked: boolean;
  lockedNote?: string;
  onCropChange: (crop: Crop) => void;
}

/** How to change the crop, and a way back to the middle, or that it can't change anymore. */
function CropControls({
  placed,
  locked,
  lockedNote = "The Square Thumbnail is uploaded with this square. Choose the photo again to pick another.",
  onCropChange,
}: CropControlsProps) {
  if (locked) return <p className="text-muted-foreground">{lockedNote}</p>;
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
interface ThumbnailPreviewProps {
  src: string;
  placed: Placed;
  overlays: Overlay[];
}

function ThumbnailPreview({ src, placed: { photo, crop }, overlays }: ThumbnailPreviewProps) {
  return (
    <figure className="flex flex-col gap-1.5">
      {/* A square, so percentages of its width and height scale the photo the same way. */}
      <div className="bg-muted relative size-40 overflow-hidden rounded-md border">
        <img
          src={src}
          alt="Preview of the Square Thumbnail"
          draggable={false}
          className="absolute max-w-none"
          style={{
            left: `${(-crop.x / crop.size) * 100}%`,
            top: `${(-crop.y / crop.size) * 100}%`,
            width: `${(photo.width / crop.size) * 100}%`,
            height: `${(photo.height / crop.size) * 100}%`,
          }}
        />
        <CropOverlays overlays={overlays} />
      </div>
      <figcaption className="text-muted-foreground text-xs">Square Thumbnail preview</figcaption>
    </figure>
  );
}
