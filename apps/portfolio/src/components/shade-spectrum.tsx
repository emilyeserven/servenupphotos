import { useMemo } from "react";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import type { PhotoImage } from "@/lib/photos";
import { stackRows } from "@/lib/shade-spectrum";
import { useWidth } from "@/lib/use-width";

/** A black and white photo the spectrum can place: its thumbnail and how light it is. */
interface SpectrumPhoto {
  id: number;
  title: string;
  image: PhotoImage;
  lightness: number | null;
}

/** A pin's width in pixels, and the gap kept between pins. */
const PIN_PX = 32;
const PIN_GAP_PX = 4;

/** The background running from black on the left to white on the right. */
const SPECTRUM_BACKGROUND = "linear-gradient(to right, #000, #fff)";

/**
 * The black and white photos as pins along a spectrum from black on the left to white on the
 * right, each at how light its grays are on average, like the color wheel's pins. Photos at
 * nearly the same lightness stack above each other. Clicking a pin opens the photo.
 */
export function ShadeSpectrum<T extends SpectrumPhoto>({
  photos,
  onOpen,
}: {
  photos: T[];
  onOpen: (photo: T) => void;
}) {
  const [ref, width] = useWidth();
  const xs = useMemo(
    () => photos.map((photo) => xOf(photo.lightness ?? 50, width)),
    [photos, width],
  );
  const rows = useMemo(() => stackRows(xs, PIN_PX, PIN_GAP_PX), [xs]);
  const height = (Math.max(0, ...rows) + 1) * (PIN_PX + PIN_GAP_PX);
  return (
    <figure className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 &&
          photos.map((photo, i) => (
            <SpectrumPin
              key={photo.id}
              photo={photo}
              x={xs[i]!}
              bottom={rows[i]! * (PIN_PX + PIN_GAP_PX)}
              onOpen={() => onOpen(photo)}
            />
          ))}
      </div>
      <div
        aria-hidden
        className="h-6 w-full rounded-full ring-1 ring-border"
        style={{ background: SPECTRUM_BACKGROUND }}
      />
      <div aria-hidden className="flex justify-between text-xs text-muted-foreground">
        <span>Black</span>
        <span>White</span>
      </div>
      <figcaption className="text-center text-sm text-muted-foreground">
        Black and white photos, whose grays make up nearly all of them, from black to white by how
        light they are on average. The color wheel shows the rest.
      </figcaption>
    </figure>
  );
}

/** Where a pin's middle goes, in pixels from the left, for lightness (0–100) along width pixels. */
function xOf(lightness: number, width: number): number {
  return PIN_PX / 2 + (lightness / 100) * Math.max(0, width - PIN_PX);
}

/** A photo's pin: its square thumbnail, bottom pixels up from the spectrum. */
function SpectrumPin({
  photo,
  x,
  bottom,
  onOpen,
}: {
  photo: SpectrumPhoto;
  x: number;
  bottom: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      title={photo.title}
      aria-label={`Show ${photo.title}`}
      onClick={onOpen}
      className="absolute block -translate-x-1/2 cursor-zoom-in overflow-hidden rounded-md bg-muted shadow-md shadow-black/30 ring-2 ring-white outline-none transition-transform hover:z-10 hover:scale-150 focus-visible:z-10 focus-visible:scale-150 focus-visible:ring-sky-500"
      style={{ left: x, bottom, width: PIN_PX, height: PIN_PX }}
    >
      <PhotoThumbnail image={photo.image} />
    </button>
  );
}
