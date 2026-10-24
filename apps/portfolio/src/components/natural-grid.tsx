import { type ReactNode, useMemo } from "react";
import { naturalRows, ratioOf } from "@/lib/natural-rows";
import type { PhotoImage } from "@/lib/photos";
import { useSize } from "@/lib/use-size";
import { cn } from "@/lib/utils";

/** How wide the grid is taken to be before it's measured. */
const UNMEASURED_WIDTH = 1200;

/**
 * The Grid's **Natural** view: each photo at its own aspect ratio, in justified rows, with
 * vertical photos gathered into taller rows of their own so they show larger (`lib/natural-rows.ts`).
 * A full row's tiles grow together to fill its width, so they only get taller; the last rows keep
 * their starting size.
 */
export function NaturalGrid<T extends { id: number; image: PhotoImage }>({
  photos,
  showInfo,
  renderTile,
}: {
  photos: T[];
  /** Whether tiles show their captions, which puts rows further apart. */
  showInfo: boolean;
  renderTile: (photo: T) => ReactNode;
}) {
  const [ref, size] = useSize();
  const width = size.width || UNMEASURED_WIDTH;
  const rows = useMemo(() => naturalRows(photos, width), [photos, width]);
  return (
    <div ref={ref} className={cn("flex flex-col", showInfo ? "gap-6" : "gap-3")}>
      {rows.map((row) => (
        <ul key={row.photos[0]!.id} className="flex gap-x-3">
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
 * the screen, so it shrinks to fit.
 */
function tileStyle(ratio: number, height: number, full: boolean) {
  // Scaled up, since grow factors adding up to less than 1 (one vertical photo) only share out
  // part of the room left.
  return { flexGrow: full ? ratio * 100 : 0, flexBasis: ratio * height, minWidth: 0 };
}
