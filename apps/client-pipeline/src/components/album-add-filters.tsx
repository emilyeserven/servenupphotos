import { useMemo } from "react";
import type { InFlightFileRead } from "@/api/photos";
import { GallerySortToggle, sortGallery, useGallerySort } from "@/components/gallery/gallery-sort";
import {
  GRID_FILTER_PARAMS,
  GridFilterBar,
  useGridFilters,
} from "@/components/gallery/grid-filters";
import { PhotoFilterBar, usePhotoFilters } from "@/components/photo-filters";
import { type SavedPhoto, matchesSearch } from "@/components/saved-photo-picker";

/**
 * The prefix of the Add photos modal's With and Without filters in the album page's URL, such as
 * `?hasTitle=without`, the same as the Gallery's, so they don't clash with the Grid's filters.
 */
const HAS_FILTERS = "has";

/** The search params of the modal's sort and Grid filters, which its Clear filters clears too. */
const OTHER_PARAMS = ["sort", ...GRID_FILTER_PARAMS];

/**
 * The photos to pick from that match the search text, the Gallery's With and Without filters and
 * the portfolio Grid's filters, in the Gallery's sort, all kept in the album page's URL.
 */
export function useAddChoices(photos: SavedPhoto[], search: string) {
  const { filters, filter } = usePhotoFilters(HAS_FILTERS);
  const sort = useGallerySort();
  const byPath = new Map(photos.map((photo) => [photo.path, photo]));
  const files = useMemo(() => photos.map((photo) => photo.file), [photos]);
  const searched = photos.filter((photo) => matchesSearch(photo, search)).map(({ file }) => file);
  const grid = useGridFilters(files, sortGallery(filter(searched), sort));
  return {
    filters,
    sort,
    grid,
    total: photos.length,
    shown: grid.shown.flatMap((file) => savedOf(byPath, file)),
  };
}

/** The photos the modal shows, its filters, and what they leave out of how many. */
type AddChoices = ReturnType<typeof useAddChoices>;

function savedOf(byPath: Map<string, SavedPhoto>, file: InFlightFileRead): SavedPhoto[] {
  const photo = byPath.get(file.path);
  return photo ? [photo] : [];
}

/**
 * The Add photos modal's filter bar: the Gallery's With and Without filters and its sort, then the
 * portfolio Grid's **Show filters**.
 */
export function AddPhotoFilters({ choices }: { choices: AddChoices }) {
  const { filters, sort, grid, shown, total } = choices;
  return (
    <>
      <PhotoFilterBar
        filters={filters}
        shown={shown.length}
        total={total}
        hiding={shown.length < total}
        extraChosen={sort !== undefined || grid.count > 0}
        extraParams={OTHER_PARAMS}
        prefix={HAS_FILTERS}
      >
        <GallerySortToggle sort={sort} />
      </PhotoFilterBar>
      <GridFilterBar photos={grid.photos} />
    </>
  );
}
