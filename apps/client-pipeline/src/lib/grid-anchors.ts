/** How many photos a row of the feed holds: the Grid Anchor and the 2 just before it make one. */
export const ANCHOR_ROW = 3;

/** Where a photo stands in the rows worked out from the Grid Anchor. */
export interface AnchorPlace {
  /** The row's place along the calendar, oldest first, from 0; rows alternate colors by it. */
  group: number;
  /** Whether the photo is the Grid Anchor itself. */
  isAnchor: boolean;
  /** Whether the photo ends its row: the Grid Anchor, or an anchor worked out from it. */
  isRowEnd: boolean;
  /** The row's name, from the newest of its photos that has one, or null when none does. */
  name: string | null;
}

/** The calendar's photo file paths, oldest day first. */
function calendarPaths(byDay: Map<string, { path: string }>): string[] {
  return [...byDay.keys()].toSorted().map((day) => byDay.get(day)?.path ?? "");
}

/**
 * The one Grid Anchor every row is worked out from: of the calendar photos marked as one
 * (flagged), the latest on the calendar, or null when none is.
 */
export function definitiveAnchor(
  byDay: Map<string, { path: string }>,
  flagged: Set<string>,
): string | null {
  return calendarPaths(byDay).findLast((path) => flagged.has(path)) ?? null;
}

/**
 * The index of the last photo in the row of the photo at i, counting rows of ANCHOR_ROW from the
 * anchor at a: back from it for photos up to the anchor, on from it for photos after it.
 */
function rowEnd(i: number, a: number): number {
  if (i <= a) return a - ANCHOR_ROW * Math.floor((a - i) / ANCHOR_ROW);
  return a + ANCHOR_ROW * Math.ceil((i - a) / ANCHOR_ROW);
}

/** Each row's name: that of the newest of its photos with one. rowOf is each photo's row end, in calendar order. */
function rowNames(rowOf: Map<string, number>, names: Map<string, string>): Map<number, string> {
  const named = new Map<number, string>();
  for (const [path, end] of rowOf) {
    const name = names.get(path);
    if (name !== undefined) named.set(end, name);
  }
  return named;
}

/**
 * Every calendar photo's row, by file path, worked out from the one Grid Anchor (anchor): it ends
 * a row of ANCHOR_ROW with the photos just before it, and the rest of the calendar falls into rows
 * of ANCHOR_ROW counted back and on from it, so moving the anchor shifts every row. names is each
 * photo's group name, by file path. Empty when the anchor isn't on the calendar.
 */
export function anchorPlaces(
  byDay: Map<string, { path: string }>,
  anchor: string | null,
  names: Map<string, string>,
): Map<string, AnchorPlace> {
  const paths = calendarPaths(byDay);
  const a = anchor === null ? -1 : paths.indexOf(anchor);
  const places = new Map<string, AnchorPlace>();
  if (a === -1) return places;
  const rowOf = new Map(paths.map((path, i) => [path, rowEnd(i, a)]));
  const named = rowNames(rowOf, names);
  const order = new Map<number, number>();
  paths.forEach((path, i) => {
    const end = rowOf.get(path) ?? i;
    if (!order.has(end)) order.set(end, order.size);
    places.set(path, {
      group: order.get(end) ?? 0,
      isAnchor: i === a,
      isRowEnd: i === end,
      name: named.get(end) ?? null,
    });
  });
  return places;
}

/**
 * The photo that holds the name of path's row: the newest photo in it with a name, or else path
 * itself, so a rename changes the name the row already shows.
 */
export function nameHolder(
  path: string,
  places: Map<string, AnchorPlace>,
  names: Map<string, string>,
): string {
  const group = places.get(path)?.group;
  const row = [...places].filter(([, place]) => place.group === group).map(([p]) => p);
  return row.findLast((p) => names.has(p)) ?? path;
}

/** The Grid Anchor flag and group name fields of a photo's JSON. */
interface AnchorFields {
  socialGridAnchor?: unknown;
  socialGridGroupName?: unknown;
}

/**
 * The photos marked as a Grid Anchor, and each photo's group name (ones blank or not text left
 * out), from each photo's JSON by file path.
 */
export function readAnchorFields(files: { path: string; data: AnchorFields }[]) {
  const flagged = new Set<string>();
  const names = new Map<string, string>();
  for (const { path, data } of files) {
    if (data.socialGridAnchor === true) flagged.add(path);
    const name = data.socialGridGroupName;
    if (typeof name === "string" && name.trim()) names.set(path, name);
  }
  return { flagged, names };
}

/** What the badge on a row's last photo says: "Grid Anchor" or "Row end", with the row's name. */
export function badgeLabel({ isAnchor, name }: AnchorPlace): string {
  const kind = isAnchor ? "Grid Anchor" : "Row end";
  return name ? `${kind}: ${name.trim()}` : kind;
}
