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
}

/**
 * Each Grid Anchor on the calendar with the photos on the calendar's days just before it, up to
 * ANCHOR_ROW in all. byDay is each calendar day's photo; anchored holds the anchors' file paths.
 */
export function anchorGroups(
  byDay: Map<string, { path: string }>,
  anchored: Set<string>,
): AnchorGroup[] {
  const paths = [...byDay.keys()].toSorted().map((day) => byDay.get(day)?.path ?? "");
  const groups: AnchorGroup[] = [];
  paths.forEach((path, i) => {
    if (!anchored.has(path)) return;
    const members = paths.slice(Math.max(0, i - ANCHOR_ROW + 1), i + 1).toReversed();
    groups.push({ anchor: path, members, index: groups.length });
  });
  return groups;
}

/** Where a photo stands in the Grid Anchor groups: its group's index, and whether it's the anchor. */
export interface AnchorPlace {
  group: number;
  isAnchor: boolean;
}

/** Each grouped photo's place, by file path. A photo in two groups takes the later one. */
export function anchorPlaces(groups: AnchorGroup[]): Map<string, AnchorPlace> {
  const places = new Map<string, AnchorPlace>();
  for (const { anchor, members, index } of groups) {
    for (const path of members) places.set(path, { group: index, isAnchor: path === anchor });
  }
  return places;
}

/** How a Grid Anchor's group sits in the feed. */
export interface FeedAlignment {
  group: AnchorGroup;
  /** Whether the group fills one row of the feed by itself, anchor first. */
  aligned: boolean;
  /**
   * How many tiles sit before the anchor in its row: 0 when it starts a row. This many fewer posts
   * after it, or ANCHOR_ROW minus this many more, would start the row with it.
   */
  offset: number;
}

/**
 * How each group whose anchor is in the feed (newest first, three to a row) lines up: aligned when
 * the anchor starts a row and the rest of the group follows it in that row.
 */
export function feedAlignments(feed: { path: string }[], groups: AnchorGroup[]): FeedAlignment[] {
  return groups.flatMap((group) => {
    const at = feed.findIndex((entry) => entry.path === group.anchor);
    if (at === -1) return [];
    const offset = at % ANCHOR_ROW;
    const together = group.members.every((path, k) => feed[at + k]?.path === path);
    return [{ group, aligned: offset === 0 && together, offset }];
  });
}

/** "1 post", "2 posts". */
function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** How a group sits in the feed, after its anchor's name: lined up, or what would line it up. */
export function alignmentText({ aligned, offset }: FeedAlignment): string {
  if (aligned) return "fills a row.";
  if (offset === 0) return "starts a row, but other posts sit between its photos.";
  const more = count(ANCHOR_ROW - offset, "more post");
  return `is ${count(offset, "tile")} into its row: ${more} after it, or ${offset} fewer, would line it up.`;
}
