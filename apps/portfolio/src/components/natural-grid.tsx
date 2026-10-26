import { type ReactNode, useMemo } from "react";
import { naturalRows, ratioOf, type RowSizes } from "@/lib/natural-rows";
import type { PhotoImage } from "@/lib/photos";
import { useSize } from "@/lib/use-size";
import { cn } from "@/lib/utils";

/** How wide the grid is taken to be before it's measured. */
const UNMEASURED_WIDTH = 1200;

/** How much of the window's height a tile can take up at most. */
const MAX_HEIGHT_SHARE = 0.9;

/**
 * The Grid's **Natural** view: each photo at its own aspect ratio, in justified rows, with
 * vertical photos gathered into taller rows of their own so they show larger (`lib/natural-rows.ts`).
 * A full row's tiles grow together to fill its width, so they only get taller; the last rows keep
 * their starting size.
 */
export function NaturalGrid<T extends { id: number; image: PhotoImage }>({
  photos,
  showInfo,
  sizes,
  renderTile,
}: {
  photos: T[];
  /** How big the rows start out, from the Grid's **Size** option. */
  sizes: RowSizes;
  /** Whether tiles show their captions, which puts rows further apart. */
  showInfo: boolean;
  renderTile: (photo: T) => ReactNode;
}) {
  const [ref, size] = useSize();
  const width = size.width || UNMEASURED_WIDTH;
  const rows = useMemo(
    () => naturalRows(photos, width, window.innerHeight * MAX_HEIGHT_SHARE, sizes),
    [photos, width, sizes],
  );
  return (
    <div ref={ref} className={cn("flex flex-col", showInfo ? "gap-6" : "gap-3")}>
      {rows.map((row) => (
        <ul key={row.photos[0]!.id} className={cn("flex gap-x-3", row.full && "justify-center")}>
          {row.photos.map((photo) => (
            <li key={photo.id} style={tileStyle(ratioOf(photo), row.height, row.full)}>
              {renderTile(photo)}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

/**
 * A tile's place in its row: as wide as the row's height makes it, growing with its aspect ratio
 * when the row is full so every tile stays the same height. On a phone a photo can be wider than
 * the screen, so it shrinks to fit. No tile grows taller than 90% of the window; a row whose
 * tiles all reach that is centered instead of filling its width.
 */
function tileStyle(ratio: number, height: number, full: boolean) {
  // Scaled up, since grow factors adding up to less than 1 (one vertical photo) only share out
  // part of the room left.
  return {
    flexGrow: full ? ratio * 100 : 0,
    flexBasis: ratio * height,
    minWidth: 0,
    maxWidth: `calc(${ratio} * ${MAX_HEIGHT_SHARE * 100}vh)`,
  };
}
