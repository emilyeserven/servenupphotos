/** How many photos a Grid Anchor's group holds: the anchor and the ones just before it, one row of the feed. */
export const ANCHOR_ROW = 3;

/** Where a photo stands in the groups of the calendar: its group, and whether it's that group's anchor. */
export interface AnchorPlace {
  /** The group's place along the calendar, oldest first, from 0; groups alternate colors by it. */
  group: number;
  isAnchor: boolean;
  /** The anchor's group name, on its group's photos; null for a group without one or with no anchor of its own. */
  name: string | null;
}

/**
 * The index of the last photo in the group of the photo at i, counting rows of ANCHOR_ROW from
 * the anchor at a: back from it for photos up to the anchor, on from it for photos after it.
 */
function groupEnd(i: number, a: number): number {
  if (i <= a) return a - ANCHOR_ROW * Math.floor((a - i) / ANCHOR_ROW);
  return a + ANCHOR_ROW * Math.ceil((i - a) / ANCHOR_ROW);
}

/** The anchor the photo at i counts its row from: the next one at or after it, or else the last. */
function anchorFor(i: number, anchorAt: number[]): number {
  return anchorAt.find((a) => a >= i) ?? anchorAt.at(-1) ?? i;
}

/**
 * Every calendar photo's group, by file path, once there's a Grid Anchor: each anchor ends a group
 * of ANCHOR_ROW with the photos just before it, and the rest of the calendar falls into rows of
 * ANCHOR_ROW counted from the anchors (photos before an anchor from it, photos after the last one
 * on from it), so a row cut short between two anchors is a group of its own. byDay is each
 * calendar day's photo; anchors is each anchor's group name (or null), by its file path. Empty
 * when there's no anchor.
 */
export function anchorPlaces(
  byDay: Map<string, { path: string }>,
  anchors: Map<string, string | null>,
): Map<string, AnchorPlace> {
  const paths = [...byDay.keys()].toSorted().map((day) => byDay.get(day)?.path ?? "");
  const anchorAt = paths.flatMap((path, i) => (anchors.has(path) ? [i] : []));
  const places = new Map<string, AnchorPlace>();
  if (anchorAt.length === 0) return places;
  const groupIndex = new Map<number, number>();
  paths.forEach((path, i) => {
    const end = groupEnd(i, anchorFor(i, anchorAt));
    if (!groupIndex.has(end)) groupIndex.set(end, groupIndex.size);
    const name = anchors.get(paths[end] ?? "") ?? null;
    places.set(path, { group: groupIndex.get(end) ?? 0, isAnchor: anchors.has(path), name });
  });
  return places;
}
