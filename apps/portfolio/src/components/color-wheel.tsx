import { PhotoThumbnail } from "@/components/photo-thumbnail";
import { type VividMeasure, vividnessOf } from "@/lib/color-sort";
import { hueAngle, WHEEL_BACKGROUND, wheelPoint } from "@/lib/color-wheel";
import type { ColorShare } from "@/lib/photo-colors";
import type { PhotoImage } from "@/lib/photos";

/** A photo the wheel can place: its thumbnail, colors and vividness. */
interface WheelPhoto {
  id: number;
  title: string;
  image: PhotoImage;
  palette: ColorShare[];
  vividness: number;
  peakVividness: number;
}

/**
 * The least vividness the wheel's edge stands for, so a page of only muted photos isn't stretched
 * out to the edge as though they were vivid.
 */
const MIN_EDGE = 20;

/**
 * The photos as pins on a color wheel, like the Map page's: around it by hue, red at the top, and
 * out from the gray middle by vividness (by measure), the most vivid at the edge. Clicking a pin
 * opens the photo.
 */
export function ColorWheel<T extends WheelPhoto>({
  photos,
  measure,
  onOpen,
}: {
  photos: T[];
  measure: VividMeasure;
  onOpen: (photo: T) => void;
}) {
  const mostVivid = Math.max(MIN_EDGE, ...photos.map((photo) => vividnessOf(photo, measure)));
  return (
    <figure className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3">
      <div className="relative aspect-square w-full">
        <div
          aria-hidden
          className="absolute inset-[3%] rounded-full opacity-70 shadow-inner"
          style={{ background: WHEEL_BACKGROUND }}
        />
        {photos.map((photo) => (
          <WheelPin
            key={photo.id}
            photo={photo}
            at={wheelPoint(hueAngle(photo.palette), vividnessOf(photo, measure), mostVivid)}
            onOpen={() => onOpen(photo)}
          />
        ))}
      </div>
      <figcaption className="text-center text-sm text-muted-foreground">
        Around the wheel by color, red at the top. Out from the middle by{" "}
        {measure === "peak" ? "peak vividness" : "vividness"}: the most vivid photo here, at{" "}
        {mostVivid}, is at the edge.
      </figcaption>
    </figure>
  );
}

const PIN_CLASS =
  "absolute block size-7 -translate-x-1/2 -translate-y-1/2 cursor-zoom-in overflow-hidden rounded-md bg-muted shadow-md shadow-black/30 ring-2 ring-white outline-none transition-transform hover:z-10 hover:scale-150 focus-visible:z-10 focus-visible:scale-150 focus-visible:ring-sky-500 sm:size-9";

/** A photo's pin: its square thumbnail at its place on the wheel. */
function WheelPin({
  photo,
  at,
  onOpen,
}: {
  photo: WheelPhoto;
  at: { x: number; y: number };
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      title={photo.title}
      aria-label={`Show ${photo.title}`}
      onClick={onOpen}
      className={PIN_CLASS}
      style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
    >
      <PhotoThumbnail image={photo.image} />
    </button>
  );
}
