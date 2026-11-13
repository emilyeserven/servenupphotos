import type { GraphStat } from "@portfolio/lib/graph-data";
import { genres, tagAndSubTags, tags } from "@portfolio/lib/groups";
import { matchesOrientation, ORIENTATION_KEY, ORIENTATIONS } from "@portfolio/lib/orientation";
import {
  colorLabel,
  HUE_BUCKETS,
  isBlackAndWhite,
  isShade,
  type ColorName,
} from "@portfolio/lib/photo-colors";
import type { Photo } from "@portfolio/lib/photos";
import { type Bucket, bucketGroup, type StatGroup, type StatRow } from "@portfolio/lib/stat-groups";

/** The group with its rows biggest first, then by name, as the Numbers page lists a group's values. */
function biggestFirst(group: StatGroup): StatGroup {
  const rows = group.rows.toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { ...group, rows };
}

/** Each genre as a row, filtering to it. */
const GENRE_BUCKETS: Bucket[] = genres.map((genre) => ({
  key: genre.id,
  label: genre.name,
  filter: { genre: genre.id },
}));

/** The genres the photos are in, biggest first; a photo counts in each genre it has. */
function genreGroup(list: Photo[]): StatGroup {
  return biggestFirst(
    bucketGroup("Genre", list, GENRE_BUCKETS, (photo, bucket) => photo.genres.includes(bucket.key)),
  );
}

/** Each tag as a row, filtering to it. */
const TAG_BUCKETS: Bucket[] = tags.map((tag) => ({
  key: tag.id,
  label: tag.name,
  filter: { tag: tag.id },
}));

/** Each tag's ID with the IDs of the tags under it, as the tag filter matches them. */
const TAG_IDS = new Map(tags.map((tag) => [tag.id, tagAndSubTags(tag.id)]));

/** Whether the photo has the bucket's tag or one of the tags under it. */
function hasTag(photo: Photo, bucket: Bucket): boolean {
  const ids = TAG_IDS.get(bucket.key);
  return photo.tags.some((tag) => ids?.has(tag));
}

/** The tags the photos have, biggest first; a photo counts in each tag it has, and in the tags over those. */
function tagGroup(list: Photo[]): StatGroup {
  return biggestFirst(bucketGroup("Tags", list, TAG_BUCKETS, hasTag));
}

/** The row of Main color for the photos that are black and white, or close to it. */
const BLACK_AND_WHITE = "Black & white";

/**
 * A photo's main color: the hue that takes up the most of it, such as "orange", or Black & white
 * when nearly all of it is blacks, grays and whites; null until the pipeline saves its colors.
 */
export function mainColor(photo: Photo): ColorName | typeof BLACK_AND_WHITE | null {
  if (photo.palette.length === 0) return null;
  if (isBlackAndWhite(photo.palette)) return BLACK_AND_WHITE;
  return photo.palette.find((part) => !isShade(part.color))?.color ?? BLACK_AND_WHITE;
}

/**
 * A row for the photos among the list that `inside` keeps, filtering to them one by one, since the
 * site has no filter for what the row counts; a row with no photos has no filter, as no chosen
 * photos would mean every photo.
 */
function photosRow(label: string, list: Photo[], inside: (photo: Photo) => boolean): StatRow {
  const ids = list.filter(inside).map((photo) => photo.id);
  return ids.length > 0 ? { label, count: ids.length, filter: { ids } } : { label, count: 0 };
}

/** The photos' main colors, around the color wheel from red, then Black & white; the ones no photo has left out. */
function mainColorGroup(list: Photo[]): StatGroup {
  const rows = [...HUE_BUCKETS, BLACK_AND_WHITE]
    .map((color) =>
      photosRow(
        color === BLACK_AND_WHITE ? color : colorLabel(color as ColorName),
        list,
        (photo) => mainColor(photo) === color,
      ),
    )
    .filter((row) => row.count > 0);
  const missing = list.filter((photo) => mainColor(photo) === null).length;
  return { title: "Main color", rows, missing, missingReason: "unknown" };
}

/** The bands Lightness puts the photos in, each a fifth of the way from black to white. */
const LIGHTNESS_BANDS = ["Very dark", "Dark", "Medium", "Light", "Very light"];

/** How wide each band of Lightness is, out of 100. */
const BAND_WIDTH = 20;

/** The band a photo's lightness falls in, 0 for Very dark; null until the pipeline saves its colors. */
export function lightnessBand({ lightness }: Photo): number | null {
  if (lightness === null) return null;
  return Math.min(LIGHTNESS_BANDS.length - 1, Math.max(0, Math.floor(lightness / BAND_WIDTH)));
}

/** How light the photos are, from Very dark to Very light, every band kept so the scale stays whole. */
function lightnessGroup(list: Photo[]): StatGroup {
  const rows = LIGHTNESS_BANDS.map((label, band) => ({
    ...photosRow(label, list, (photo) => lightnessBand(photo) === band),
    detail: `${band * BAND_WIDTH} – ${(band + 1) * BAND_WIDTH}`,
  }));
  const missing = list.filter((photo) => lightnessBand(photo) === null).length;
  return { title: "Lightness", rows, missing, missingReason: "unknown" };
}

/** Each orientation as a row, filtering to it. */
const ORIENTATION_BUCKETS: Bucket[] = ORIENTATIONS.map((orientation) => ({
  key: orientation,
  label: orientation.charAt(0).toUpperCase() + orientation.slice(1),
  filter: { [ORIENTATION_KEY]: orientation },
}));

/** Which way round the photos are: horizontal, vertical or square, the ones no photo has left out. */
function orientationGroup(list: Photo[]): StatGroup {
  return bucketGroup("Orientation", list, ORIENTATION_BUCKETS, (photo, bucket) =>
    matchesOrientation(photo, bucket.key),
  );
}

/**
 * The stats only the Graph page has, about what a photo shows and how it looks: its genres and
 * tags under Subject, and its main color, lightness and orientation under Look.
 */
export const PHOTO_STATS: GraphStat[] = [
  { id: "genre", label: "Genre", section: "Subject", build: genreGroup },
  { id: "tags", label: "Tags", section: "Subject", build: tagGroup },
  { id: "mainColor", label: "Main color", section: "Look", build: mainColorGroup },
  { id: "lightness", label: "Lightness", section: "Look", build: lightnessGroup },
  { id: "orientation", label: "Orientation", section: "Look", build: orientationGroup },
];
