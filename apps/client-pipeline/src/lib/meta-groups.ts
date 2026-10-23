import type { MetaGroup } from "@/api/metainfo";
import { hasValue, type MetaValueCount, valueKey } from "@/lib/meta-values";

/** A group in the list, with how far it's nested. */
export interface MetaGroupRow {
  group: MetaGroup;
  /** 0 for a group not in another. */
  depth: number;
}

/** Sorts groups by their saved order, then by name. */
function byOrder(a: MetaGroup, b: MetaGroup): number {
  return (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "en");
}

/** The groups directly in parent ("" for the top level), in order. */
export function childrenOf(groups: MetaGroup[], parent: string): MetaGroup[] {
  return groups.filter((group) => (group.parent ?? "") === parent).toSorted(byOrder);
}

/**
 * The groups to save to move the group with id one place up (-1) or down (1) among siblings, in
 * order: every sibling numbered by its new place, keeping only the ones whose order changes.
 */
export function movedGroups(siblings: MetaGroup[], id: string, by: -1 | 1): MetaGroup[] {
  const from = siblings.findIndex((group) => group.id === id);
  const to = from + by;
  if (from === -1 || to < 0 || to >= siblings.length) return [];
  const moved = siblings.toSpliced(from, 1).toSpliced(to, 0, siblings[from]!);
  return moved
    .map((group, order) => ({ ...group, order }))
    .filter((group, i) => group.order !== (moved[i]!.order ?? 0));
}

/** Whether group's parent is one of groups; one whose parent is gone is listed at the top. */
function hasKnownParent(groups: MetaGroup[], group: MetaGroup): boolean {
  return Boolean(group.parent) && groups.some((g) => g.id === group.parent);
}

function addRows(groups: MetaGroup[], group: MetaGroup, depth: number, rows: MetaGroupRow[]) {
  rows.push({ group, depth });
  for (const child of childrenOf(groups, group.id)) addRows(groups, child, depth + 1, rows);
}

/** The groups as a tree: each top-level group in order, with the groups in it under it. */
export function groupTree(groups: MetaGroup[]): MetaGroupRow[] {
  const rows: MetaGroupRow[] = [];
  const top = groups.filter((group) => !hasKnownParent(groups, group)).toSorted(byOrder);
  for (const group of top) addRows(groups, group, 0, rows);
  return rows;
}

/** The IDs of the group and every group in it, however deep. */
export function withDescendants(groups: MetaGroup[], id: string): Set<string> {
  const ids = new Set([id]);
  for (const row of groupTree(groups)) {
    if (row.group.parent && ids.has(row.group.parent)) ids.add(row.group.id);
  }
  return ids;
}

/** How many photos have a value of the group or of a group in it. */
export function groupPhotoCount(
  values: MetaValueCount[],
  groups: MetaGroup[],
  group: MetaGroup,
): number {
  const ids = withDescendants(groups, group.id);
  const inside = groups.filter((g) => ids.has(g.id));
  return values
    .filter((v) => inside.some((g) => hasValue(g, v.value)))
    .reduce((sum, v) => sum + v.count, 0);
}

/** The names of the groups other than id that list the value with key as one of their values. */
export function otherGroupNames(
  groups: MetaGroup[],
  id: string | undefined,
  key: string,
): string[] {
  return groups
    .filter((group) => group.id !== id && group.values.some((v) => valueKey(v) === key))
    .map((group) => group.name);
}
