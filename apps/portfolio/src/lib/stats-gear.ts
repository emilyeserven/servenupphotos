import { type Bucket, bucketGroup, type StatGroup, valueGroup } from "@/lib/stat-groups";
import { groupRange, parseRange, rangeValues } from "@/lib/camera-filters";
import { groupTree, groupValues, type MetaGroup } from "@/lib/metadata-groups";
import type { Photo } from "@/lib/photos";

/** What the photos have for "no camera" in place of one. */
const UNKNOWN_CAMERA = "Unknown camera";

/** The photo's camera, or null when its EXIF didn't say. */
export function cameraOf(photo: Photo): string | null {
  return photo.camera === UNKNOWN_CAMERA ? null : photo.camera;
}

/** A focal length group's range in millimeters, such as "23–39mm", "251mm+" or "≤22mm". */
function rangeText({ range = {} }: MetaGroup): string {
  const { min, max } = range;
  if (min === undefined) return `≤${max}mm`;
  return max === undefined ? `${min}mm+` : `${min}–${max}mm`;
}

/** Where a focal length group starts, so the widest comes first. */
function rangeStart(group: MetaGroup): number {
  return group.range?.min ?? 0;
}

/**
 * A focal length range from METAINFO.json, with the Grid's range filter for it: from the shortest
 * to the longest focal length any portfolio photo has in it, so the count matches the Grid.
 */
function focalBucket(group: MetaGroup, values: string[]): Bucket {
  const range = groupRange("focalLength", group, values);
  return {
    key: range ?? "",
    label: group.name,
    detail: rangeText(group),
    filter: range ? { focalLength: range } : undefined,
  };
}

/** Whether the photo's focal length is in the bucket's range. */
function inFocalRange(photo: Photo, bucket: Bucket): boolean {
  const [low, high] = parseRange(bucket.key) ?? [];
  const length = photo.settings.focalLength;
  return length !== null && length >= Number(low) && length <= Number(high);
}

/** The focal length ranges set on the pipeline's Metadata Groups page, widest first. */
function focalGroup(list: Photo[], all: Photo[]): StatGroup {
  const values = rangeValues(all, "focalLength");
  const buckets = groupTree("focalLength")
    .filter(([, depth]) => depth === 0)
    .map(([group]) => group)
    .toSorted((a, b) => rangeStart(a) - rangeStart(b))
    .map((group) => focalBucket(group, values));
  return bucketGroup("Focal length", list, buckets, inFocalRange);
}

/** The equipment a group of metadata groups is of. */
type Equipment = "camera" | "lens";

/** A metadata group as a row, filtering to the cameras or lenses in it. */
function metaBucket(equipment: Equipment, group: MetaGroup): Bucket {
  return { key: group.id, label: group.name, filter: { [`${equipment}Group`]: group.id } };
}

/** Whether the photo's camera or lens is in the bucket's metadata group, or one inside it. */
function inMetaGroup(equipment: Equipment) {
  const values = new Map(groupTree(equipment).map(([group]) => [group.id, groupValues(group)]));
  return (photo: Photo, bucket: Bucket): boolean =>
    values.get(bucket.key)?.has(photo[equipment] ?? "") === true;
}

/** The title of a category's group, such as "Lenses by type" for the lens group Type. */
function categoryTitle(equipment: Equipment, category: MetaGroup): string {
  const plural = equipment === "lens" ? "Lenses" : "Cameras";
  return `${plural} by ${category.name.toLowerCase()}`;
}

/**
 * The camera or lens metadata groups set on the pipeline, as groups of rows: each top-level group
 * with groups in it, such as Type, is a category whose rows are the groups in it, such as Prime;
 * the top-level groups with none in them go together under "Lens groups".
 */
function categoryGroups(equipment: Equipment, list: Photo[]): StatGroup[] {
  const tree = groupTree(equipment);
  const top = tree.filter(([, depth]) => depth === 0).map(([group]) => group);
  const childrenOf = (id: string) => tree.filter(([g]) => g.parent === id).map(([g]) => g);
  const inside = inMetaGroup(equipment);
  const categories = top.filter((group) => childrenOf(group.id).length > 0);
  const loose = top.filter((group) => childrenOf(group.id).length === 0);
  const groups = categories.map((category) =>
    uncategorized(
      bucketGroup(
        categoryTitle(equipment, category),
        list.filter((photo) => photo[equipment] !== null),
        childrenOf(category.id).map((group) => metaBucket(equipment, group)),
        inside,
      ),
    ),
  );
  if (loose.length === 0) return groups;
  const title = `${equipment === "lens" ? "Lens" : "Camera"} groups`;
  const buckets = loose.map((group) => metaBucket(equipment, group));
  return [...groups, uncategorized(bucketGroup(title, list, buckets, inside))];
}

/** A group whose uncounted photos are the ones in none of its categories. */
function uncategorized(group: StatGroup): StatGroup {
  return { ...group, missingReason: "uncategorized" };
}

/** A camera or lens as a row, filtering to it. */
function equipmentBucket(equipment: Equipment) {
  return (name: string): Bucket => ({ key: name, label: name, filter: { [equipment]: name } });
}

/** The Gear section's groups: cameras, lenses, their categories and focal length ranges. */
export function gearGroups(list: Photo[], all: Photo[]): StatGroup[] {
  return [
    valueGroup("Cameras", list, cameraOf, equipmentBucket("camera")),
    ...categoryGroups("camera", list),
    valueGroup("Lenses", list, (photo) => photo.lens, equipmentBucket("lens")),
    ...categoryGroups("lens", list),
    focalGroup(list, all),
  ];
}
