import { type GridSize, type SizedView, sizeParam } from "@/lib/grid-size";

/** The tiles' display options as the **Display Options** flyout sets them. */
export interface TileOptions {
  size: GridSize | undefined;
  info: boolean;
  ordered: boolean;
  bands: boolean;
}

/** The URL's display options for the tiles, leaving out each default. */
export function optionsSearch(view: Exclude<SizedView, "table">, next: TileOptions) {
  return {
    size: next.size && sizeParam(view, next.size),
    info: next.info || undefined,
    ordered: next.ordered ? undefined : (false as const),
    bands: next.bands || undefined,
  };
}
