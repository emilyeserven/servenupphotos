import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CameraPicker } from "@portfolio/components/camera-picker";
import { type OwnFilters, PhotoFilterBar } from "@portfolio/components/photo-filters";
import { OrientationFilter } from "@portfolio/components/orientation-filter";
import type { Photo } from "@portfolio/lib/photos";
import { filterPhotos, parseFilters } from "@portfolio/lib/photo-filters";
import {
  CAMERA_FILTER_KEYS,
  filterByCamera,
  type CameraFilters,
  parseCameraFilters,
  withoutCameraFilters,
} from "@portfolio/lib/camera-filters";
import { ORIENTATION_KEY, orientationCounts } from "@portfolio/lib/orientation";
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
 * The camera filters, after the shared ones on the Table and Grid: the **Camera** picker, for the
 * camera, lens, focal length, aperture, exposure and ISO, and the **Orientation** buttons.
 * `photos` is the photos the shared filters leave, which the picker's counts are out of, given the
 * other filters here. `children` go after them, in the filters' row, such as the Grid's **Colors**.
 */
function CameraFilterControls({
  photos,
  filters,
  children,
}: {
  photos: Photo[];
  filters: CameraFilters;
  children: ReactNode;
}) {
  const setFilters = useSetCameraFilters();
  return (
    <>
      <CameraPicker photos={photos} filters={filters} onChange={setFilters} />
      <OrientationFilter
        orientation={filters[ORIENTATION_KEY]}
        counts={orientationCounts(
          filterByCamera(photos, withoutCameraFilters(filters, [ORIENTATION_KEY])),
        )}
        onChange={(orientation) => setFilters({ [ORIENTATION_KEY]: orientation })}
      />
      {children}
    </>
  );
}

const NO_EXTRA: OwnFilters = { keys: [], count: 0, children: null };

/**
 * The filter bar of the Table and Grid: the shared filters every view has, then the camera
 * filters, all in one **Show filters** panel, so both views always offer the same ones. `extra`
 * are a view's own filters after those, in the sliders' row, such as the Grid's **Colors**.
 * `searchable` adds the text search box, which the camera filters' counts then leave out too.
 */
export function CameraFilterBar({
  photos,
  extra = NO_EXTRA,
  searchable = false,
}: {
  photos: Photo[];
  extra?: OwnFilters;
  searchable?: boolean;
}) {
  const search = useSearch({ strict: false });
  const own = parseCameraFilters(search);
  const searched = searchable ? searchPhotos(photos, parseTextSearch(search).q) : photos;
  return (
    <PhotoFilterBar
      photos={photos}
      searchable={searchable}
      facet={filterByCamera(photos, own)}
      own={{
        keys: [...CAMERA_FILTER_KEYS, ...extra.keys],
        count: Object.keys(own).length + extra.count,
        children: (
          <CameraFilterControls photos={filterPhotos(searched, parseFilters(search))} filters={own}>
            {extra.children}
          </CameraFilterControls>
        ),
      }}
    />
  );
}
