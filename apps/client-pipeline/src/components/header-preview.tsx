import { type CSSProperties, useState } from "react";
import { FallbackImage } from "@/components/fallback-image";
import type { PreviewPhoto } from "@/components/spotlight-preview";
import { offlineSmallUrl } from "@/lib/offline-thumbnails";
import { type Size, objectPosition } from "@portfolio/lib/spotlight-focus";

/** A screen a header spotlight is drawn for: its width, and 30% of its height, as on the portfolio. */
interface HeaderScreen {
  label: string;
  width: number;
  height: number;
}

const SCREENS: HeaderScreen[] = [
  { label: "Phone", width: 390, height: Math.round(844 * 0.3) },
  { label: "Computer", width: 1440, height: Math.round(900 * 0.3) },
];

/**
 * The photo in a header spotlight, such as the Grid's, on a phone held upright and on a computer:
 * across the page's width, 30% of the screen's height, cropped around its focus point and fading
 * into the page at the bottom, as the portfolio draws it.
 */
export function HeaderPreview({ photo }: { photo: PreviewPhoto }) {
  return (
    <div className="flex flex-col gap-3">
      {SCREENS.map((screen) => (
        <HeaderFigure key={screen.label} screen={screen} photo={photo} />
      ))}
    </div>
  );
}

/** One screen's header, as wide as its place, with its name under it. */
function HeaderFigure({ screen, photo }: { screen: HeaderScreen; photo: PreviewPhoto }) {
  const [image, setImage] = useState<Size>({ width: 1, height: 1 });
  const style: CSSProperties = {
    objectPosition: objectPosition(photo.focus, photo.placement, image, screen),
  };
  return (
    <figure className="flex flex-col gap-1" style={{ maxWidth: screen.width }}>
      <div
        aria-hidden
        className="ring-border bg-background relative overflow-hidden rounded-md ring-1"
        style={{ aspectRatio: `${screen.width} / ${screen.height}` }}
      >
        <FallbackImage
          src={photo.src}
          fallback={offlineSmallUrl(photo.src)}
          alt=""
          style={style}
          onLoad={(event) =>
            setImage({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          className="absolute inset-0 size-full object-cover"
        />
        <div className="to-background absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-b from-transparent" />
      </div>
      <figcaption className="text-muted-foreground text-xs">{screen.label}</figcaption>
    </figure>
  );
}
