import {
  type CameraFilters,
  type EquipmentKey,
  filterByCamera,
  withoutCameraFilters,
} from "@portfolio/lib/camera-filters";
import { equipmentOptions, type FilterOption } from "@portfolio/lib/filter-options";
import { photos as allPhotos, type Photo } from "@portfolio/lib/photos";

/** The camera or lens choices the Camera picker lists, and the one chosen, if any. */
interface EquipmentChoices {
  /** Every choice, each counting the photos it would show given the other filters. */
  options: FilterOption[];
  chosen?: FilterOption;
}

/**
 * The camera or lens choices for `photos`, the photos the other filters leave: its metadata
 * groups, then each camera or lens by name, with the one the filters choose.
 */
export function equipmentChoices(
  equipment: EquipmentKey,
  photos: Photo[],
  filters: CameraFilters,
): EquipmentChoices {
  const own = [equipment, `${equipment}Group`] as const;
  const facet = filterByCamera(photos, withoutCameraFilters(filters, own));
  const options = equipmentOptions(equipment, allPhotos, facet, {
    group: filters[`${equipment}Group`],
    name: filters[equipment],
  });
  return { options, chosen: options.find((option) => isChosen(option, filters)) };
}

/** Whether the filters choose this camera or lens choice. */
export function isChosen(option: FilterOption, filters: CameraFilters): boolean {
  return filters[option.key as keyof CameraFilters] === option.value;
}

/**
 * The filters choosing a camera or lens choice, such as `lensGroup: "lens-zoom"`, clearing the
 * other of the name and the group; no choice clears both.
 */
export function equipmentFilters(equipment: EquipmentKey, option?: FilterOption): CameraFilters {
  const cleared = { [equipment]: undefined, [`${equipment}Group`]: undefined };
  return option ? { ...cleared, [option.key]: option.value } : cleared;
}
