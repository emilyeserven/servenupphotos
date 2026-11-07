import {
  axisRows,
  type GraphConfig,
  type GraphSeries,
  rowPhotos,
  seriesColor,
  splitSeries,
  statById,
} from "@/lib/graph-data";
import { isSplit } from "@/lib/graph-pick";
import type { Photo } from "@/lib/photos";

/** One photo on a photo dot graph, with its dot's color: its split value's, or the graph's own. */
export interface PhotoDot {
  photo: Photo;
  color: string;
}

/** One x value's stack of dots, one for each of its photos. */
export interface DotColumn {
  label: string;
  dots: PhotoDot[];
}

/** What a photo dot graph draws: a stack of dots for each x value, and the split's colors for its key. */
export interface PhotoDotsData {
  columns: DotColumn[];
  /** The split's values with their colors; empty when the graph isn't split. */
  series: GraphSeries[];
}

/**
 * Each of the photos with the color of the first split value it has, in the split's order; the ones
 * past the split's colors, or with no split value, after them in Other's gray.
 */
function splitDots(photos: Photo[], split: string, series: GraphSeries[]): PhotoDot[] {
  const placed = new Set<Photo>();
  const dots: PhotoDot[] = [];
  const other = seriesColor(Number.MAX_SAFE_INTEGER);
  const colors = new Map(series.map((s) => [s.label, s.color]));
  for (const row of statById(split).build(photos).rows) {
    const color = colors.get(row.label) ?? other;
    for (const photo of rowPhotos(photos, row).filter((each) => !placed.has(each))) {
      placed.add(photo);
      dots.push({ photo, color });
    }
  }
  const rest = photos.filter((photo) => !placed.has(photo));
  return [...dots, ...rest.map((photo) => ({ photo, color: other }))];
}

/** The photos' dots in one color, oldest first. */
function plainDots(photos: Photo[]): PhotoDot[] {
  return photos
    .toSorted((a, b) => a.takenAt.getTime() - b.takenAt.getTime())
    .map((photo) => ({ photo, color: seriesColor(0) }));
}

/**
 * A photo dot graph: for each x value, in the order picked and cut by the Range group, a dot for each
 * of its photos, colored by the split when there is one.
 */
export function photoDots(list: Photo[], config: GraphConfig): PhotoDotsData {
  const split = isSplit(config);
  const series = split ? splitSeries(statById(config.split).build(list).rows) : [];
  const columns = axisRows(list, config).map((row) => {
    const photos = rowPhotos(list, row);
    const dots = split ? splitDots(photos, config.split, series) : plainDots(photos);
    return { label: row.label, dots };
  });
  return { columns, series };
}
