import type { EquipmentKey } from "@portfolio/lib/camera-filters";
import type { FilterOption } from "@portfolio/lib/filter-options";
import type { Photo } from "@portfolio/lib/photos";

/**
 * How the Cameras or Lenses list orders the cameras or lenses under each heading or group: as the tab lists them (by
 * name), or by when the first of the portfolio's photos was taken with each, oldest or newest first.
 */
export type EquipmentSort = "name" | "oldest" | "newest";

/** When the first of the photos was taken with each camera or lens, in ms, by name. */
function firstTaken(photos: Photo[], equipment: EquipmentKey): Map<string, number> {
  const first = new Map<string, number>();
  for (const photo of photos) {
    const name = photo[equipment];
    const time = photo.takenAt.getTime();
    if (name) first.set(name, Math.min(time, first.get(name) ?? time));
  }
  return first;
}

/** The first photo's time for each camera and lens, worked out once for each photo list. */
const firstTakenByPhotos = new WeakMap<Photo[], Record<EquipmentKey, Map<string, number>>>();

/** The first photo's time for each camera and lens in the photos. */
function firstTakenOf(photos: Photo[]): Record<EquipmentKey, Map<string, number>> {
  const known = firstTakenByPhotos.get(photos);
  if (known) return known;
  const first = { camera: firstTaken(photos, "camera"), lens: firstTaken(photos, "lens") };
  firstTakenByPhotos.set(photos, first);
  return first;
}

/** Whether two rows are cameras or lenses by name side by side at the same depth, so they sort together. */
function sameRun(equipment: EquipmentKey, a: FilterOption | undefined, b: FilterOption): boolean {
  return a?.key === equipment && b.key === equipment && a.depth === b.depth;
}

/** The rows in runs: each camera or lens by name with its neighbors at its depth, and every other row alone. */
function runsOf(equipment: EquipmentKey, options: FilterOption[]): FilterOption[][] {
  const runs: FilterOption[][] = [];
  for (const option of options) {
    const run = runs.at(-1);
    if (run && sameRun(equipment, run.at(-1), option)) run.push(option);
    else runs.push([option]);
  }
  return runs;
}

/**
 * The choices with each run of cameras or lenses by name, under the same heading or group, put in
 * the order `sort` asks for; headings and groups stay where they are. A camera with no photos goes
 * last either way. When each was first used comes from `photos`, the view's photos before any filter.
 */
export function sortEquipment(
  equipment: EquipmentKey,
  options: FilterOption[],
  sort: EquipmentSort,
  photos: Photo[],
): FilterOption[] {
  if (sort === "name") return options;
  const first = firstTakenOf(photos)[equipment];
  const sign = sort === "oldest" ? 1 : -1;
  const time = (option: FilterOption) => first.get(option.value) ?? sign * Number.MAX_SAFE_INTEGER;
  return runsOf(equipment, options).flatMap((run) =>
    run.toSorted((a, b) => sign * (time(a) - time(b))),
  );
}
