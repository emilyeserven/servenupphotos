import { PhotoThumbnail } from "@/components/photo-thumbnail";
import type { WheelPoint } from "@/lib/color-wheel";
import type { PhotoImage } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * A cluster's pin on the color wheel, like the Map page's: how many photos it covers, over the
 * first one's thumbnail, darkened so the number stays readable. The display options can hide the
 * count, and show the thumbnail as it is, with the count in a small dark badge instead. Clicking it
 * zooms in on it, which splits it apart.
 */
export function WheelClusterPin({
  image,
  count,
  at,
  size,
  showCount,
  dimmed,
  onZoomIn,
}: {
  /** The first of its photos' images. */
  image: PhotoImage;
  count: number;
  at: WheelPoint;
  /** Its width in pixels. */
  size: number;
  /** Whether the count is shown. */
  showCount: boolean;
  /** Whether the thumbnail is darkened under the count. */
  dimmed: boolean;
  onZoomIn: () => void;
}) {
  return (
    <button
      type="button"
      title={`Zoom in on these ${count} photos`}
      aria-label={`Zoom in on these ${count} photos`}
      onClick={onZoomIn}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-zoom-in items-center justify-center overflow-hidden rounded-full bg-neutral-900 font-semibold text-white shadow-md shadow-black/30 ring-2 ring-white outline-none transition-transform hover:z-10 hover:scale-125 focus-visible:z-10 focus-visible:scale-125 focus-visible:ring-sky-500"
      style={{
        left: `${at.x * 100}%`,
        top: `${at.y * 100}%`,
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.4)),
      }}
    >
      <span aria-hidden className="absolute inset-0">
        <PhotoThumbnail image={image} />
      </span>
      {dimmed && <span aria-hidden className="absolute inset-0 bg-black/60" />}
      {showCount && <ClusterCount count={count} badge={!dimmed} />}
    </button>
  );
}

/** The cluster's count, in a dark badge when the thumbnail behind it isn't darkened. */
function ClusterCount({ count, badge }: { count: number; badge: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative",
        badge && "rounded-full bg-black/70 px-1 leading-tight tabular-nums",
      )}
    >
      {count}
    </span>
  );
}
