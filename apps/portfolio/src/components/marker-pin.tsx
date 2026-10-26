import { PhotoThumbnail } from "@/components/photo-thumbnail";
import { WheelClusterPin } from "@/components/wheel-cluster-pin";
import type { ColorDisplay } from "@/lib/color-display";
import type { WheelPoint } from "@/lib/color-wheel";
import type { PhotoImage } from "@/lib/photos";
import type { WheelMarker } from "@/lib/wheel-clusters";

/** A photo a pin can show: its title and thumbnail. */
export interface PinPhoto {
  id: number;
  title: string;
  image: PhotoImage;
}

/** A marker's pin, on the color wheel or the Black & white chart: a cluster's, or its one photo's. */
export function MarkerPin<T extends PinPhoto>({
  marker,
  photos,
  size,
  display,
  onOpen,
  onZoomIn,
}: {
  marker: WheelMarker;
  photos: T[];
  /** Its width in pixels. */
  size: number;
  /** Whether a cluster's pin shows its count, and darkens its photo under it. */
  display: Pick<ColorDisplay, "showCounts" | "dimGroups">;
  onOpen: (photo: T) => void;
  onZoomIn: () => void;
}) {
  const first = photos[marker.members[0]!]!;
  if (marker.members.length > 1) {
    return (
      <WheelClusterPin
        image={first.image}
        count={marker.members.length}
        at={marker.at}
        size={size}
        showCount={display.showCounts}
        dimmed={display.dimGroups}
        onZoomIn={onZoomIn}
      />
    );
  }
  return <PhotoPin photo={first} at={marker.at} size={size} onOpen={() => onOpen(first)} />;
}

const PIN_CLASS =
  "absolute block -translate-x-1/2 -translate-y-1/2 cursor-zoom-in overflow-hidden rounded-md bg-muted shadow-md shadow-black/30 ring-2 ring-white outline-none transition-transform hover:z-10 hover:scale-150 focus-visible:z-10 focus-visible:scale-150 focus-visible:ring-sky-500";

/** A photo's pin: its square thumbnail at its place, a fraction of the canvas's width and height. */
function PhotoPin({
  photo,
  at,
  size,
  onOpen,
}: {
  photo: PinPhoto;
  at: WheelPoint;
  size: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      title={photo.title}
      aria-label={`Show ${photo.title}`}
      onClick={onOpen}
      className={PIN_CLASS}
      style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%`, width: size, height: size }}
    >
      <PhotoThumbnail image={photo.image} />
    </button>
  );
}
