import { type ReactNode, type Ref, useMemo } from "react";
import {
  type NaturalRow,
  naturalRows,
  ratioOf,
  type RowSizes,
  type Shaped,
} from "@/lib/natural-rows";
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
  const [ref, width] = useMeasuredWidth();
  const rows = useMemo(() => layoutNaturalRows(photos, width, sizes), [photos, width, sizes]);
  return <NaturalRows ref={ref} rows={rows} showInfo={showInfo} renderTile={renderTile} />;
}

/** A ref for an element and its width in pixels, taken to be 1200px until it's measured. */
export function useMeasuredWidth() {
  const [ref, size] = useSize();
  return [ref, size.width || UNMEASURED_WIDTH] as const;
}

/**
 * The photos in justified rows across width pixels at the starting sizes, with no tile taller
 * than 90% of the window (`lib/natural-rows.ts`).
 */
export function layoutNaturalRows<T extends Shaped>(
  photos: T[],
  width: number,
  sizes: RowSizes,
): NaturalRow<T>[] {
  return naturalRows(photos, width, window.innerHeight * MAX_HEIGHT_SHARE, sizes);
}

/** Natural rows already laid out, each tile as tall as its row and the full rows filling their width. */
export function NaturalRows<T extends { id: number; image: PhotoImage }>({
  ref,
  rows,
  showInfo,
  renderTile,
}: {
  ref?: Ref<HTMLDivElement>;
  rows: NaturalRow<T>[];
  /** Whether tiles show their captions, which puts rows further apart. */
  showInfo: boolean;
  renderTile: (photo: T) => ReactNode;
}) {
  return (
    <div ref={ref} className={cn("flex flex-col", showInfo ? "gap-6" : "gap-3")}>
      {rows.map((row) => (
        <ul key={row.photos[0]!.id} className={cn("flex gap-x-3", row.full && "justify-center")}>
          {row.photos.map((photo) => (
            <li
              key={photo.id}
              data-photo-id={photo.id}
              style={tileStyle(ratioOf(photo), row.height, row.full)}
            >
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
