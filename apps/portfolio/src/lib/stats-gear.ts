import {
  type Bucket,
  bucketGroup,
  type GroupDef,
  type GroupVariant,
  type StatGroup,
  valueGroup,
} from "@portfolio/lib/stat-groups";
import { groupRange, parseRange, rangeValues } from "@portfolio/lib/camera-filters";
import { groupTree, groupValues, type MetaGroup } from "@portfolio/lib/metadata-groups";
import { type Photo, photos as allPhotos } from "@portfolio/lib/photos";

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

/**
 * The focal lengths a lens covers, as its name writes them, such as [18, 135] for
 * "EF-S18-135mm f/3.5-5.6 IS STM" or [50, 50] for "EF50mm f/1.8 II"; undefined when it doesn't say.
 */
function lensFocalLengths(name: string): [number, number] | undefined {
  const match = /(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s*mm/i.exec(name);
  if (!match) return undefined;
  const low = Number(match[1]);
  return [low, Number(match[2] ?? low)];
}

/** The focal lengths a lens was used at in the portfolio's photos, for a lens whose name doesn't say. */
function usedFocalLengths(name: string): number[] {
  return allPhotos.flatMap((photo) =>
    photo.lens === name && photo.settings.focalLength !== null ? [photo.settings.focalLength] : [],
  );
}

/**
 * The focal lengths the lenses in a lens group cover, such as "55–250mm": from their names, or
 * else from the photos taken with them; undefined when neither says.
 */
function lensGroupSpan(group: MetaGroup): string | undefined {
  const lengths = [...groupValues(group)].flatMap(
    (name) => lensFocalLengths(name) ?? usedFocalLengths(name),
  );
  if (lengths.length === 0) return undefined;
  const [low, high] = [Math.min(...lengths), Math.max(...lengths)];
  return low === high ? `${low}mm` : `${low}–${high}mm`;
}

/**
 * A metadata group as a row, filtering to the cameras or lenses in it. A lens group says the focal
 * lengths its lenses cover.
 */
function metaBucket(equipment: Equipment, group: MetaGroup): Bucket {
  const detail = equipment === "lens" ? lensGroupSpan(group) : undefined;
  return { key: group.id, label: group.name, detail, filter: { [`${equipment}Group`]: group.id } };
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
 * A category as a way to make the categories' group, named in the card's Group by control, such
 * as "By type": its groups as rows, counting the photos with a camera or lens.
 */
function categoryVariant(
  equipment: Equipment,
  category: string,
  title: string,
  inside: MetaGroup[],
): GroupVariant {
  const buckets = inside.map((group) => metaBucket(equipment, group));
  const known = (photo: Photo) => photo[equipment] !== null;
  return {
    label: `By ${category.toLowerCase()}`,
    build: (list) =>
      uncategorized(bucketGroup(title, list.filter(known), buckets, inMetaGroup(equipment))),
  };
}

/** Sorts the category named Type first, as the one a card opens on. */
function typeFirst(a: MetaGroup, b: MetaGroup): number {
  return Number(b.name === "Type") - Number(a.name === "Type");
}

/**
 * The camera or lens metadata groups set on the pipeline as ways to group a card: each top-level
 * group with groups in it, such as Type, is a category whose rows are the groups in it, such as
 * Prime, Type first; the top-level groups with none in them go together as "By group".
 */
function categoryVariants(equipment: Equipment): GroupVariant[] {
  const tree = groupTree(equipment).map(([group]) => group);
  const childrenOf = (id: string) => tree.filter((group) => group.parent === id);
  const top = tree.filter((group) => !tree.some((other) => other.id === group.parent));
  const categories = top.filter((group) => childrenOf(group.id).length > 0).toSorted(typeFirst);
  const loose = top.filter((group) => childrenOf(group.id).length === 0);
  const variants = categories.map((category) =>
    categoryVariant(
      equipment,
      category.name,
      categoryTitle(equipment, category),
      childrenOf(category.id),
    ),
  );
  const title = `${equipment === "lens" ? "Lens" : "Camera"} groups`;
  if (loose.length > 0) variants.push(categoryVariant(equipment, "Group", title, loose));
  return variants;
}

/** The lens categories as one card, grouped by its control, narrowing `narrows`; none without them. */
function lensCategoryDefs(narrows: string): GroupDef[] {
  const variants = categoryVariants("lens");
  if (variants.length === 0) return [];
  return [{ id: "lens-categories", narrows, build: variants[0]!.build, variants }];
}

/** Every camera as a row, the Cameras card's first way to group. */
const EACH_CAMERA: GroupVariant = {
  label: "Each camera",
  build: (list) => valueGroup("Cameras", list, cameraOf, equipmentBucket("camera")),
};

/**
 * The Cameras card: each camera, or, from its Group by control, the camera categories set on the
 * pipeline, such as By type; no control when there are none.
 */
function camerasDef(): GroupDef {
  const categories = categoryVariants("camera");
  const variants = categories.length > 0 ? [EACH_CAMERA, ...categories] : undefined;
  return { id: "cameras", build: EACH_CAMERA.build, variants };
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
 * The Gear section's groups: the lenses from the top down, the lens categories narrowing the focal
 * length ranges, which narrow the lenses; then cameras, which can be grouped by their categories.
 */
export const GEAR_GROUPS: GroupDef[] = [
  ...lensCategoryDefs("focal-length"),
  { id: "focal-length", narrows: "lenses", build: (list) => focalGroup(list, allPhotos) },
  {
    id: "lenses",
    build: (list) => valueGroup("Lenses", list, (photo) => photo.lens, equipmentBucket("lens")),
  },
  camerasDef(),
];
