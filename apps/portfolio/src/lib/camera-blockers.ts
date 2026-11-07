import {
  type CameraFilters,
  type EquipmentKey,
  filterByCamera,
  withoutCameraFilters,
} from "@portfolio/lib/camera-filters";
import type { FilterOption } from "@portfolio/lib/filter-options";
import { ORIENTATION_KEY } from "@portfolio/lib/orientation";
import {
  type FilterKey,
  filterPhotos,
  LOCATION_KEYS,
  type PhotoFilters,
  withoutFilters,
} from "@portfolio/lib/photo-filters";
import type { Photo } from "@portfolio/lib/photos";
import { searchPhotos } from "@portfolio/lib/text-search";
import { WHEN_KEYS, type WhenKey } from "@portfolio/lib/when-filters";

/**
 * One filter that's set, which can hide a camera or lens choice: its name, and the photos the
 * filters would leave without it, before the camera filters (`photos`), with the camera filters
 * it is among (`cameraKeys`) to leave out too.
 */
export interface Blocker {
  label: string;
  photos: Photo[];
  cameraKeys: readonly (keyof CameraFilters)[];
}

/** The shared filters, by the name a hidden choice's note gives them, with their keys in the URL. */
const SHARED: [string, readonly (FilterKey | WhenKey | "ids")[]][] = [
  ["Places", LOCATION_KEYS],
  ["Album", ["album"]],
  ["Tag", ["tag"]],
  ["Genre", ["genre"]],
  ["When", WHEN_KEYS],
  ["Chosen photos", ["ids"]],
];

/** The camera filters, by the name a hidden choice's note gives them, with their keys in the URL. */
const CAMERA: [string, readonly (keyof CameraFilters)[]][] = [
  ["Camera", ["camera", "cameraGroup"]],
  ["Lens", ["lens", "lensGroup"]],
  ["Focal length", ["focalLength"]],
  ["Aperture", ["aperture"]],
  ["Exposure", ["exposure"]],
  ["ISO", ["iso"]],
  ["Orientation", [ORIENTATION_KEY]],
];

/** What the filters hiding a camera or lens choice are worked out from. */
export interface BlockerSource {
  /** The view's photos, before any filter. */
  photos: Photo[];
  /** The text search, when the view has one and it's set. */
  query?: string;
  shared: PhotoFilters;
  camera: CameraFilters;
}

/**
 * Every filter that's set and could hide a camera or lens choice: the text search, the shared
 * filters, and the camera filters.
 */
export function cameraBlockers({ photos, query, shared, camera }: BlockerSource): Blocker[] {
  const searched = searchPhotos(photos, query);
  const filtered = filterPhotos(searched, shared);
  const search: Blocker[] = query
    ? [{ label: "Search", photos: filterPhotos(photos, shared), cameraKeys: [] }]
    : [];
  return [
    ...search,
    ...SHARED.filter(([, keys]) => keys.some((key) => shared[key] !== undefined)).map(
      ([label, keys]): Blocker => ({
        label,
        photos: filterPhotos(searched, withoutFilters(shared, keys)),
        cameraKeys: [],
      }),
    ),
    ...CAMERA.filter(([, keys]) => keys.some((key) => camera[key] !== undefined)).map(
      ([label, cameraKeys]): Blocker => ({ label, photos: filtered, cameraKeys }),
    ),
  ];
}

/**
 * The names of the filters hiding a camera or lens choice: each one that, left out alone, would
 * let it show photos. Empty when only leaving out more than one would.
 */
export function blockersOf(
  equipment: EquipmentKey,
  option: FilterOption,
  filters: CameraFilters,
  blockers: Blocker[],
): string[] {
  const own = [equipment, `${equipment}Group`] as const;
  const choice = { [option.key]: option.value };
  return blockers
    .filter(({ photos, cameraKeys }) => {
      const left = filterByCamera(photos, withoutCameraFilters(filters, [...own, ...cameraKeys]));
      return filterByCamera(left, choice).length > 0;
    })
    .map(({ label }) => label);
}
