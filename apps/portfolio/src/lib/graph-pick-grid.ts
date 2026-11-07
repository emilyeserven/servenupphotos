import { filterWithCamera } from "@/lib/camera-filters";
import { type GraphConfig, statById } from "@/lib/graph-data";
import { type GraphPick, isSplit, type PickedGroup } from "@/lib/graph-pick";
import { type Photo, photos as allPhotos } from "@/lib/photos";
import { searchPhotos } from "@/lib/text-search";

/** A Grid filter as the URL writes it, such as `{ country: "Japan" }`. */
type GridFilter = Record<string, unknown>;

/** The Grid filter of a stat's value, such as Season: Autumn; undefined when the Grid can't filter by it. */
function rowFilter(stat: string, label: string): GridFilter | undefined {
  return statById(stat)
    .build(allPhotos)
    .rows.find((row) => row.label === label)?.filter;
}

/** The Grid filters of the picked value and the group: its x value, and the split's or y axis's value. */
function pickParts(
  config: GraphConfig,
  pick: GraphPick,
  group: string,
): (GridFilter | undefined)[] {
  if (pick.others) return [rowFilter(config.x, group)];
  const x = rowFilter(config.x, pick.x);
  if (pick.y !== undefined) return [x, rowFilter(config.y, pick.y)];
  if (isSplit(config)) return [x, rowFilter(config.split, group)];
  return [x];
}

/** The filters as one, values of the same key together, such as two countries. */
function merged(parts: GridFilter[]): GridFilter {
  const values = new Map<string, unknown[]>();
  for (const [key, value] of parts.flatMap((part) => Object.entries(part))) {
    values.set(key, [...new Set([...(values.get(key) ?? []), ...[value].flat()])]);
  }
  return Object.fromEntries(
    [...values].map(([key, list]) => [key, list.length === 1 ? list[0] : list]),
  );
}

/** The Graph page's own filters and text search, without the photo open in the lightbox. */
function pageFilter({ photo: _photo, ...search }: GridFilter): GridFilter {
  return search;
}

/** Whether the Grid's filters and text search find exactly these photos. */
function findsExactly(filter: GridFilter, photos: Photo[]): boolean {
  const q = typeof filter.q === "string" ? filter.q : undefined;
  const found = filterWithCamera(searchPhotos(allPhotos, q), filter);
  const ids = new Set(photos.map((photo) => photo.id));
  return found.length === ids.size && found.every((photo) => ids.has(photo.id));
}

/**
 * What opens a group of the picked photos on the Grid: the Graph page's own filters and text
 * search, the picked x value and the group's value, such as Year 2016 and Season Autumn. When those
 * don't find exactly the group's photos, such as for a value the Grid can't filter by, it's the
 * photos themselves, chosen one by one.
 */
export function gridSearch(
  page: GridFilter,
  config: GraphConfig,
  pick: GraphPick,
  group: PickedGroup,
): GridFilter {
  const parts = [pageFilter(page), ...pickParts(config, pick, group.label)];
  const known = parts.filter((part) => part !== undefined);
  const filter = merged(known);
  if (known.length === parts.length && findsExactly(filter, group.photos)) return filter;
  return { ids: group.photos.map((photo) => photo.id) };
}
