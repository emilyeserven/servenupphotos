import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CameraPicker } from "@portfolio/components/camera-picker";
import type { BlockerSource } from "@portfolio/lib/camera-blockers";
import { type OwnFilters, PhotoFilterBar } from "@portfolio/components/photo-filters";
import type { Photo } from "@portfolio/lib/photos";
import { filterPhotos, parseFilters } from "@portfolio/lib/photo-filters";
import {
  CAMERA_FILTER_KEYS,
  filterByCamera,
  type CameraFilters,
  parseCameraFilters,
} from "@portfolio/lib/camera-filters";
import { parseTextSearch, searchPhotos } from "@portfolio/lib/text-search";

/** Sets some of the camera filters in the URL, keeping everything else. */
function useSetCameraFilters() {
  const navigate = useNavigate();
  return (next: CameraFilters) => {
    void navigate({
      to: ".",
      resetScroll: false,
      search: (prev: Record<string, unknown>) => ({ ...prev, ...next }),
    });
  };
}

/**
 * The camera filters, after the shared ones on the Table and Grid: the **Gear & settings** picker, for the
 * camera, lens, focal length, aperture, exposure and ISO. The orientation, though a camera filter
 * in the URL, is in the Grid's **Visuals** picker.
 * `photos` is the photos the shared filters leave, which the picker's counts are out of, given the
 * other filters here, and `source` what's needed to say which filters hide a choice. `children` go after them, in the filters' row, such as the Grid's **Visuals**.
 */
function CameraFilterControls({
  photos,
  filters,
  source,
  children,
}: {
  photos: Photo[];
  filters: CameraFilters;
  source: BlockerSource;
  children: ReactNode;
}) {
  const setFilters = useSetCameraFilters();
  return (
    <>
      <CameraPicker photos={photos} filters={filters} source={source} onChange={setFilters} />
      {children}
    </>
  );
}

const NO_EXTRA: OwnFilters = { keys: [], count: 0, children: null };

/**
 * The filter bar of the Table and Grid: the shared filters every view has, then the camera
 * filters, all in one **Show filters** panel, so both views always offer the same ones. `extra`
 * are a view's own filters after those, in the sliders' row, such as the Grid's **Visuals**.
 * `searchable` adds the text search box, which the camera filters' counts then leave out too.
 */
export function CameraFilterBar({
  photos,
  extra = NO_EXTRA,
  searchable = false,
  bare = false,
}: {
  photos: Photo[];
  extra?: OwnFilters;
  searchable?: boolean;
  /** Shows the filters always, with no Show filters button, as the Graph page's Filters tab does. */
  bare?: boolean;
}) {
  const search = useSearch({ strict: false });
  const own = parseCameraFilters(search);
  const query = searchable ? parseTextSearch(search).q : undefined;
  const shared = parseFilters(search);
  return (
    <PhotoFilterBar
      photos={photos}
      searchable={searchable}
      bare={bare}
      facet={filterByCamera(photos, own)}
      own={{
        keys: [...CAMERA_FILTER_KEYS, ...extra.keys],
        count: Object.keys(own).length + extra.count,
        children: (
          <CameraFilterControls
            photos={filterPhotos(searchPhotos(photos, query), shared)}
            filters={own}
            source={{ photos, query, shared, camera: own }}
          >
            {extra.children}
          </CameraFilterControls>
        ),
      }}
    />
  );
}
