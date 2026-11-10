/** How many photos a Grid Anchor's group holds: the anchor and the ones just before it, one row of the feed. */
export const ANCHOR_ROW = 3;

/** A Grid Anchor and the calendar photos just before it, which should fill one row of the feed. */
export interface AnchorGroup {
  /** The anchor's photo file path. */
  anchor: string;
  /** The group's photo file paths, newest first: the anchor, then the ones before it. */
  members: string[];
  /** The group's place among the calendar's groups, oldest first, from 0; it picks the group's color. */
  index: number;
  /** The group's name, or null when it has none. */
  name: string | null;
}

/**
 * Each Grid Anchor on the calendar with the photos on the calendar's days just before it, up to
 * ANCHOR_ROW in all. byDay is each calendar day's photo; anchors is each anchor's group name (or
 * null when it has none), by the anchor's file path.
 */
export function anchorGroups(
  byDay: Map<string, { path: string }>,
  anchors: Map<string, string | null>,
): AnchorGroup[] {
  const paths = [...byDay.keys()].toSorted().map((day) => byDay.get(day)?.path ?? "");
  const groups: AnchorGroup[] = [];
  paths.forEach((path, i) => {
    if (!anchors.has(path)) return;
    const members = paths.slice(Math.max(0, i - ANCHOR_ROW + 1), i + 1).toReversed();
    groups.push({ anchor: path, members, index: groups.length, name: anchors.get(path) ?? null });
  });
  return groups;
}

/** Where a photo stands in the Grid Anchor groups: its group's index and name, and whether it's the anchor. */
export interface AnchorPlace {
  group: number;
  isAnchor: boolean;
  /** The group's name, or null when it has none. */
  name: string | null;
}

/** Each grouped photo's place, by file path. A photo in two groups takes the later one. */
export function anchorPlaces(groups: AnchorGroup[]): Map<string, AnchorPlace> {
  const places = new Map<string, AnchorPlace>();
  for (const { anchor, members, index, name } of groups) {
    for (const path of members) places.set(path, { group: index, isAnchor: path === anchor, name });
  }
  return places;
}
