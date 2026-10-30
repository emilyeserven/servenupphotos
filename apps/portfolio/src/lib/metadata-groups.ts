import committedGroups from "@portfolio/data/metainfo/METAINFO.json";
import { localFile } from "@portfolio/lib/localize";

/** The photo fields a metadata group can be of, as the photo files name them. */
export type MetaField = "camera" | "lens" | "focalLength" | "aperture" | "exposure" | "iso";

/**
 * A metadata group from METAINFO.json: a named set of one field's values, such as every EXIF
 * spelling of one lens, or a range, such as **Wide angle** for focal lengths 10 to 24 mm.
 */
export interface MetaGroup {
  id: string;
  name: string;
  description?: string;
  field: MetaField;
  /** The ID of the group of the same field this one is in; "" at the top. */
  parent: string;
  /** The values in the group, as the photo files write them. */
  values: (string | number)[];
  /** Where it goes among the groups with the same parent, lowest first; missing counts as 0. */
  order?: number;
  /**
   * For a focal length, aperture, exposure or ISO group, every value from `min` to `max`, both
   * included. One end can be missing: only `min` is that and up, only `max` is up to that.
   */
  range?: { min?: number; max?: number };
}

// Like ALLPHOTOS.local.json, METAINFO.local.json is git-ignored and only there locally.
/** Every metadata group, from METAINFO.json. */
const metaGroups: MetaGroup[] =
  localFile(
    import.meta.glob<MetaGroup[]>("../data/metainfo/METAINFO.local.json", {
      eager: true,
      import: "default",
    }),
  ) ?? (committedGroups as MetaGroup[]);

/** Sorts groups by their order, lowest first, then by name. */
function byOrder(a: MetaGroup, b: MetaGroup): number {
  return (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name);
}

/**
 * The groups of the field directly inside the group with the ID, or the top-level ones for "", in
 * their order.
 */
function groupsIn(field: MetaField, parent: string): MetaGroup[] {
  const known = new Set(metaGroups.filter((group) => group.field === field).map(({ id }) => id));
  return metaGroups
    .filter(
      (group) =>
        group.field === field &&
        group.id !== parent &&
        // A group whose parent isn't a group of its field goes at the top, so it isn't lost.
        (known.has(group.parent) ? group.parent : "") === parent,
    )
    .toSorted(byOrder);
}

/**
 * The group with the ID and every group inside it, however deep, each before what's in it. A loop
 * of parents stops where it comes back round.
 */
export function groupAndInside(
  group: MetaGroup,
  found = new Map<string, MetaGroup>(),
): MetaGroup[] {
  if (found.has(group.id)) return [...found.values()];
  found.set(group.id, group);
  for (const inside of groupsIn(group.field, group.id)) groupAndInside(inside, found);
  return [...found.values()];
}

/** The group of the field with the ID, if there is one. */
export function metaGroupById(field: MetaField, id: string): MetaGroup | undefined {
  return metaGroups.find((group) => group.field === field && group.id === id);
}

/** Every value the group and the groups inside it list, as text, as the filters compare them. */
export function groupValues(group: MetaGroup): Set<string> {
  return new Set(groupAndInside(group).flatMap(({ values }) => values.map(String)));
}

/**
 * Every group of the field, each before the groups inside it, with how deep it is. The pipeline
 * doesn't save a loop of parents, so this doesn't look for one.
 */
export function groupTree(field: MetaField, parent = "", depth = 0): [MetaGroup, number][] {
  return groupsIn(field, parent).flatMap((group) => [
    [group, depth] as [MetaGroup, number],
    ...groupTree(field, group.id, depth + 1),
  ]);
}
