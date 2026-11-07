import {
  type Bucket,
  bucketGroup,
  type GroupDef,
  type StatGroup,
  valueGroup,
} from "@/lib/stat-groups";
import { groupRange, parseRange, rangeValues } from "@/lib/camera-filters";
import { groupTree, groupValues, type MetaGroup } from "@/lib/metadata-groups";
import { type Photo, photos as allPhotos } from "@/lib/photos";

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

/** The ID of the group of every camera or lens, which their categories narrow. */
const EQUIPMENT_GROUP_IDS: Record<Equipment, string> = { camera: "cameras", lens: "lenses" };

/** A category's group: its groups as rows, counting the photos with a camera or lens. */
function categoryDef(
  equipment: Equipment,
  id: string,
  title: string,
  inside: MetaGroup[],
): GroupDef {
  const buckets = inside.map((group) => metaBucket(equipment, group));
  const known = (photo: Photo) => photo[equipment] !== null;
  return {
    id,
    narrows: EQUIPMENT_GROUP_IDS[equipment],
    build: (list) =>
      uncategorized(bucketGroup(title, list.filter(known), buckets, inMetaGroup(equipment))),
  };
}

/**
 * The camera or lens metadata groups set on the pipeline, as groups of rows: each top-level group
 * with groups in it, such as Type, is a category whose rows are the groups in it, such as Prime;
 * the top-level groups with none in them go together under "Lens groups". Each narrows the group
 * of every camera or lens.
 */
function categoryDefs(equipment: Equipment): GroupDef[] {
  const tree = groupTree(equipment).map(([group]) => group);
  const childrenOf = (id: string) => tree.filter((group) => group.parent === id);
  const top = tree.filter((group) => !tree.some((other) => other.id === group.parent));
  const categories = top.filter((group) => childrenOf(group.id).length > 0);
  const loose = top.filter((group) => childrenOf(group.id).length === 0);
  const defs = categories.map((category) =>
    categoryDef(
      equipment,
      `${equipment}-${category.id}`,
      categoryTitle(equipment, category),
      childrenOf(category.id),
    ),
  );
  if (loose.length === 0) return defs;
  const title = `${equipment === "lens" ? "Lens" : "Camera"} groups`;
  return [...defs, categoryDef(equipment, `${equipment}-groups`, title, loose)];
}

/** A group whose uncounted photos are the ones in none of its categories. */
function uncategorized(group: StatGroup): StatGroup {
  return { ...group, missingReason: "uncategorized" };
}

/** A camera or lens as a row, filtering to it. */
function equipmentBucket(equipment: Equipment) {
  return (name: string): Bucket => ({ key: name, label: name, filter: { [equipment]: name } });
}

/**
 * The Gear section's groups: cameras, the lens categories (narrowing the lenses), lenses and focal
 * length ranges. Camera categories come before the cameras when there are any.
 */
export const GEAR_GROUPS: GroupDef[] = [
  ...categoryDefs("camera"),
  {
    id: "cameras",
    build: (list) => valueGroup("Cameras", list, cameraOf, equipmentBucket("camera")),
  },
  ...categoryDefs("lens"),
  {
    id: "lenses",
    build: (list) => valueGroup("Lenses", list, (photo) => photo.lens, equipmentBucket("lens")),
  },
  { id: "focal-length", build: (list) => focalGroup(list, allPhotos) },
];
