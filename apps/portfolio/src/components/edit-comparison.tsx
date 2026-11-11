import { Columns2, type LucideIcon, Repeat2, SquareSplitHorizontal } from "lucide-react";
import { type CSSProperties, type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import type { PhotoImage } from "@portfolio/lib/photo-image";
import type { OriginalCrop } from "@portfolio/lib/unedited-original";
import { CONTROL_FRAME, controlButtonClass } from "@portfolio/lib/segmented-control";
import { cn } from "@portfolio/lib/utils";

// Shared with the pipeline's Photo page, so it imports with @portfolio/ (docs/gallery.md).

/** How a photo is compared with its unedited original. */
export type ComparisonMode = "slider" | "side" | "switch";

/** The ways to compare, in the order the picker lists them; the first is the default. */
const MODES: { value: ComparisonMode; label: string; Icon: LucideIcon }[] = [
  { value: "slider", label: "Slider", Icon: SquareSplitHorizontal },
  { value: "side", label: "Side by side", Icon: Columns2 },
  { value: "switch", label: "Switch", Icon: Repeat2 },
];

/** The comparison mode a URL's `mode` names, left out for the default, the slider. */
export function parseComparisonMode(value: unknown): { mode?: Exclude<ComparisonMode, "slider"> } {
  return value === "side" || value === "switch" ? { mode: value } : {};
}

/** The buttons that pick how the edit and the original are compared. */
export function ComparisonModePicker({
  mode,
  onChange,
}: {
  mode: ComparisonMode;
  onChange: (mode: ComparisonMode) => void;
}) {
  return (
    <div role="group" aria-label="Compare by" className={cn(CONTROL_FRAME, "w-fit")}>
      {MODES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={controlButtonClass(mode === value)}
        >
          <Icon aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

interface EditComparisonProps {
  /** The edited photo's resized versions, as the portfolio shows it. */
  edited: PhotoImage;
  /**
   * Its unedited original's resized versions, with the part of it the edit shows when the edit was
   * cropped: the Slider and Switch draw only that part, so the two line up.
   */
  original: PhotoImage & { crop?: OriginalCrop | null };
  /** What the photo shows, for screen readers. */
  alt: string;
  mode: ComparisonMode;
  /** The tallest the photo may be drawn, as a CSS length; 75svh when left out. */
  maxHeight?: string;
}

/**
 * The edited photo next to its unedited original: a **Slider** with a line to drag across them (the
 * original on its left, the edit on its right), the two **Side by side** (the whole original, even
 * when the edit was cropped), or one at a time to **Switch** between.
 */
export function EditComparison({ mode, ...props }: EditComparisonProps) {
  if (mode === "side") return <SideBySide {...props} />;
  if (mode === "switch") return <SwitchComparison {...props} />;
  return <SliderComparison {...props} />;
}

type ShownProps = Omit<EditComparisonProps, "mode">;

/** The box both photos are drawn in: the edit's shape, no taller than maxHeight. */
function frameStyle({ edited, maxHeight = "75svh" }: ShownProps): CSSProperties {
  const ratio = edited.width / edited.height;
  return { aspectRatio: `${ratio}`, maxWidth: `calc(${maxHeight} * ${ratio})` };
}

/** One of the two photos, filling the box it's in without cropping. */
function ComparedImage({
  image,
  alt,
  sizes,
  className,
}: {
  image: PhotoImage;
  alt: string;
  sizes: string;
  className?: string;
}) {
  return (
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      alt={alt}
      draggable={false}
      className={cn("size-full object-contain select-none", className)}
    />
  );
}

/**
 * The original filling the box it's in, drawn from its crop when it has one: the crop is stretched
 * to the box, which has the edit's shape, as the crop does, and the rest is cut off.
 */
function CroppedOriginal({
  image,
  alt,
  sizes,
}: {
  image: EditComparisonProps["original"];
  alt: string;
  sizes: string;
}) {
  const { crop } = image;
  if (!crop) return <ComparedImage image={image} alt={alt} sizes={sizes} />;
  const style: CSSProperties = {
    width: `${(image.width / crop.width) * 100}%`,
    height: `${(image.height / crop.height) * 100}%`,
    left: `${(-crop.x / crop.width) * 100}%`,
    top: `${(-crop.y / crop.height) * 100}%`,
  };
  return (
    <div className="absolute inset-0 overflow-hidden">
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={sizes}
        alt={alt}
        draggable={false}
        className="absolute max-w-none object-fill select-none"
        style={style}
      />
    </div>
  );
}

/** A small label in a corner of a photo, saying which one it is. */
function CornerLabel({ children, side }: { children: string; side: "left" | "right" }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      {children}
    </span>
  );
}

const FULL_WIDTH = "(min-width: 1280px) 1280px, 100vw";

/** The divider's place in percent from the left, kept between 0 and 100. */
function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** How far the arrow keys move the divider: 1% with Shift, else 5%; Home and End go to the ends. */
function keyedPosition(event: KeyboardEvent, position: number): number | null {
  const step = event.shiftKey ? 1 : 5;
  const moves: Record<string, number> = {
    ArrowLeft: position - step,
    ArrowDown: position - step,
    ArrowRight: position + step,
    ArrowUp: position + step,
    Home: 0,
    End: 100,
  };
  return event.key in moves ? clampPercent(moves[event.key] as number) : null;
}

/**
 * The divider that's dragged across the two photos: pressing anywhere on them moves it there, and
 * it follows the pointer until it's let go. Focused, the arrow keys move it.
 */
function useDivider() {
  const frame = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const moveTo = (event: PointerEvent) => {
    const box = frame.current?.getBoundingClientRect();
    if (box && box.width > 0)
      setPosition(clampPercent(((event.clientX - box.left) / box.width) * 100));
  };
  return {
    frame,
    position,
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      moveTo(event);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event);
    },
    onKeyDown: (event: KeyboardEvent) => {
      const next = keyedPosition(event, position);
      if (next === null) return;
      event.preventDefault();
      setPosition(next);
    },
  };
}

/** The original over the edit, cut off at a line that's dragged across them. */
function SliderComparison(props: ShownProps) {
  const { original, edited, alt } = props;
  const { frame, position, onKeyDown, ...drag } = useDivider();
  return (
    <div
      ref={frame}
      {...drag}
      className="relative mx-auto w-full cursor-ew-resize touch-pan-y overflow-hidden rounded-md bg-muted"
      style={frameStyle(props)}
    >
      <ComparedImage image={edited} alt={`${alt}, edited`} sizes={FULL_WIDTH} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <CroppedOriginal image={original} alt={`${alt}, unedited original`} sizes={FULL_WIDTH} />
      </div>
      <CornerLabel side="left">Original</CornerLabel>
      <CornerLabel side="right">Edited</CornerLabel>
      <DividerHandle position={position} onKeyDown={onKeyDown} />
    </div>
  );
}

/** The line between the two photos, with a round grip a keyboard can move. */
function DividerHandle({
  position,
  onKeyDown,
}: {
  position: number;
  onKeyDown: (event: KeyboardEvent) => void;
}) {
  return (
    <div
      className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_4px_rgb(0_0_0/0.6)]"
      style={{ left: `${position}%` }}
    >
      <div
        role="slider"
        tabIndex={0}
        aria-label="Divider between the original and the edit"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(position)}% original`}
        onKeyDown={onKeyDown}
        className="absolute top-1/2 left-1/2 flex size-9 -translate-1/2 items-center justify-center rounded-full border-2 border-white bg-black/50 text-white shadow outline-none focus-visible:ring-4 focus-visible:ring-ring"
      >
        <SquareSplitHorizontal className="size-4" aria-hidden />
      </div>
    </div>
  );
}

/** The original and the edit next to each other, one above the other on a phone. */
function SideBySide({ original, edited, alt, maxHeight = "75svh" }: ShownProps) {
  const sizes = "(min-width: 640px) 50vw, 100vw";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        { image: original, label: "Original", text: `${alt}, unedited original` },
        { image: edited, label: "Edited", text: `${alt}, edited` },
      ].map(({ image, label, text }) => (
        <figure key={label} className="flex flex-col gap-1.5">
          <div
            className="relative mx-auto w-full overflow-hidden rounded-md bg-muted"
            style={frameStyle({ edited: image, original, alt, maxHeight })}
          >
            <ComparedImage image={image} alt={text} sizes={sizes} />
          </div>
          <figcaption className="text-center text-sm text-muted-foreground">{label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** One photo at a time, switched by its buttons or by clicking the photo. */
function SwitchComparison(props: ShownProps) {
  const { original, edited, alt } = props;
  const [showOriginal, setShowOriginal] = useState(false);
  const label = showOriginal ? "Original" : "Edited";
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => setShowOriginal((shown) => !shown)}
        aria-label={
          showOriginal
            ? "Showing the original; switch to the edit"
            : "Showing the edit; switch to the original"
        }
        title="Click to switch"
        className="relative mx-auto block w-full cursor-pointer overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-4 focus-visible:ring-ring"
        style={frameStyle(props)}
      >
        <ComparedImage image={edited} alt={`${alt}, edited`} sizes={FULL_WIDTH} />
        {/* Both stay loaded, so switching is instant. */}
        <div className={cn("absolute inset-0", !showOriginal && "invisible")}>
          <CroppedOriginal image={original} alt={`${alt}, unedited original`} sizes={FULL_WIDTH} />
        </div>
        <CornerLabel side="left">{label}</CornerLabel>
      </button>
      <div role="group" aria-label="Show" className={CONTROL_FRAME}>
        {[false, true].map((original) => (
          <button
            key={String(original)}
            type="button"
            aria-pressed={showOriginal === original}
            onClick={() => setShowOriginal(original)}
            className={controlButtonClass(showOriginal === original)}
          >
            {original ? "Original" : "Edited"}
          </button>
        ))}
      </div>
    </div>
  );
}
