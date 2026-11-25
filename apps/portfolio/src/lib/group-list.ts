import type { FilterOption } from "@portfolio/lib/filter-options";

/**
 * How the Groups picker orders an album, tag or genre list: as it's set (the albums' and genres'
 * own order), A to Z or Z to A by name, or by how many photos each would show, most or fewest
 * first. Each sub-album, child tag or subgenre is sorted among the others under the same parent.
 */
export type GroupSort = "set" | "az" | "za" | "most" | "fewest";

/** One row of a searched and sorted list: the choice, and whether it's only there as a match's parent. */
export interface GroupRow {
  option: FilterOption;
  /** True for a parent shown only so a match under it has its place; the parent itself doesn't match. */
  context: boolean;
}

/** A choice with the choices under it. */
interface Node {
  option: FilterOption;
  children: Node[];
}

/** The flat list, where each choice is followed by the ones under it a depth deeper, as a tree. */
function treeOf(options: FilterOption[]): Node[] {
  const roots: Node[] = [];
  const path: Node[] = [];
  for (const option of options) {
    const node = { option, children: [] };
    path.length = Math.min(path.length, option.depth);
    (path.at(-1)?.children ?? roots).push(node);
    path.push(node);
  }
  return roots;
}

/** Orders two choices by their English names, ignoring case. */
function byName(a: FilterOption, b: FilterOption): number {
  return a.label.english.localeCompare(b.label.english, undefined, { sensitivity: "base" });
}

/** How each sort compares two choices under the same parent; "set" keeps them as they are. */
const COMPARE: Record<GroupSort, ((a: FilterOption, b: FilterOption) => number) | undefined> = {
  set: undefined,
  az: byName,
  za: (a, b) => byName(b, a),
  most: (a, b) => b.count - a.count || byName(a, b),
  fewest: (a, b) => a.count - b.count || byName(a, b),
};

/** Whether the choice's name, in any of the ways it's written, has the search text in it. */
function matches(option: FilterOption, query: string): boolean {
  return Object.values(option.label).some((name) => name.toLowerCase().includes(query));
}

/**
 * The rows for the nodes and what's under them, sorted. With search text, a node that matches
 * shows with everything under it; one that doesn't shows only while something under it matches,
 * marked as context.
 */
function rowsOf(nodes: Node[], sort: GroupSort, query: string): GroupRow[] {
  const compare = COMPARE[sort];
  const sorted = compare ? nodes.toSorted((a, b) => compare(a.option, b.option)) : nodes;
  return sorted.flatMap(({ option, children }) => {
    if (!query || matches(option, query)) {
      return [{ option, context: false }, ...rowsOf(children, sort, "")];
    }
    const below = rowsOf(children, sort, query);
    return below.length > 0 ? [{ option, context: true }, ...below] : [];
  });
}

/**
 * The Groups picker's album, tag or genre choices, in the order `sort` asks for, each child kept
 * under its parent. With search text, only the choices whose names have it are left, each with
 * everything under it and with its parents above it for context.
 */
export function searchAndSortGroups(
  options: FilterOption[],
  sort: GroupSort,
  query: string,
): GroupRow[] {
  return rowsOf(treeOf(options), sort, query.trim().toLowerCase());
}
