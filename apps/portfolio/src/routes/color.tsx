import { createFileRoute } from "@tanstack/react-router";
import { Palette } from "lucide-react";
import { ColorBar } from "@/components/color-bar";
import { ColorFilter } from "@/components/color-filter";
import { ColorLayoutControl } from "@/components/color-layout-control";
import { ColorWheel } from "@/components/color-wheel";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { ColorMatchControl, parseThreshold } from "@/components/color-match-control";
import { ColorSortControl } from "@/components/color-sort-control";
import { parseVividness, VividnessControl } from "@/components/vividness-control";
import { ViewPlaceholder } from "@/components/view-placeholder";
import { type ColorMatch, matchesColor, matchText } from "@/lib/color-match";
import {
  type ColorOrder,
  type ColorSort,
  sortPhotos,
  type VividMeasure,
  vividnessOf,
} from "@/lib/color-sort";
import { COLORS, type ColorName, isColorName } from "@/lib/photo-colors";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";

interface ColorSearch {
  /** The hue bucket or shade to show photos of; left out to show every photo. */
  color?: ColorName;
  /** Set to match photos by a share of the color; left out to match the photos it's the largest color of. */
  match?: "threshold";
  /** How much of a photo, in percent, the color needs to match by share; left out for DEFAULT_PERCENT. */
  min?: number;
  /** Set to sort photos by vividness; left out to sort them by color. */
  sort?: ColorSort;
  /**
   * Set to sort the other way: white back to red, the least of the picked color first, or the most
   * vivid first; left out for red to white, the most of the picked color first, or the least vivid first.
   */
  order?: ColorOrder;
  /** The secondary sort, always the one sort isn't; left out for none. */
  secondary?: ColorSort;
  /** Set to run the secondary sort the other way; left out for ascending. */
  secondaryOrder?: ColorOrder;
  /** The least vividness a photo needs to show, from 0 to 100; left out for 0, which shows every photo. */
  vivid?: number;
  /** Set to sort and filter by peak vividness; left out for the average. */
  measure?: VividMeasure;
  /** Set to show the photos in a grid; left out for the color wheel. */
  view?: "grid";
}

export const Route = createFileRoute("/color")({
  validateSearch: (search: Record<string, unknown>): ColorSearch & ShownPhotoSearch => ({
    ...(isColorName(search.color) ? { color: search.color } : {}),
    ...(search.match === "threshold" ? { match: "threshold" as const } : {}),
    ...minOf(search.min),
    ...sortOf(search),
    ...vividOf(search.vivid),
    ...displayOf(search),
    ...parseShownPhoto(search),
  }),
  component: ColorView,
});

/** A photo with resized versions in R2 and its colors saved, which is all this page can show. */
type ColorPhoto = Photo & { image: PhotoImage; vividness: number; peakVividness: number };

/**
 * How much of a photo, in percent, a color needs by default to match by share, so a photo
 * shows for its main colors, not every speck. The page's slider changes it.
 */
const DEFAULT_PERCENT = 30;

/** The `?min=` to keep, leaving it out when it's missing or not one the slider can set. */
function minOf(value: unknown): ColorSearch {
  const min = parseThreshold(value);
  return min === undefined ? {} : { min };
}

/** The `?sort=`, `?order=`, `?secondary=` and `?secondaryOrder=` to keep, each left out at its default. */
function sortOf({ sort, order, secondary, secondaryOrder }: Record<string, unknown>): ColorSearch {
  const main: ColorSort = sort === "vivid" ? "vivid" : "color";
  return {
    ...(main === "vivid" ? { sort: main } : {}),
    ...descOf("order", order),
    ...secondaryOf(main, secondary),
    ...descOf("secondaryOrder", secondaryOrder),
  };
}

/** `{ [key]: "desc" }` when value is "desc", which is all an order keeps. */
function descOf(key: "order" | "secondaryOrder", value: unknown): ColorSearch {
  return value === "desc" ? { [key]: "desc" as const } : {};
}

/** The `?secondary=` to keep: only the sort that isn't main. */
function secondaryOf(main: ColorSort, secondary: unknown): ColorSearch {
  const other: ColorSort = main === "vivid" ? "color" : "vivid";
  return secondary === other ? { secondary: other } : {};
}

/** The `?measure=` and `?view=` to keep, each left out at its default. */
function displayOf({ measure, view }: Record<string, unknown>): ColorSearch {
  return {
    ...(measure === "peak" ? { measure: "peak" as const } : {}),
    ...(view === "grid" ? { view: "grid" as const } : {}),
  };
}

/** The `?vivid=` to keep, leaving it out when it's missing or not one the slider can set. */
function vividOf(value: unknown): ColorSearch {
  const vivid = parseVividness(value);
  return vivid === undefined ? {} : { vivid };
}

// Newest first, so photos of the same color stay newest first when sorted by color.
const colorPhotos = photos
  .filter(
    (photo): photo is ColorPhoto =>
      photo.image !== null && photo.palette.length > 0 && hasVividness(photo),
  )
  .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());

/** Whether the photo's colors were saved with how vivid they are. */
function hasVividness(photo: Photo): boolean {
  return photo.vividness !== null && photo.peakVividness !== null;
}

/** The photos at least as vivid as vivid, by the URL's measure. */
function vividPhotos({ vivid = 0, measure = "average" }: ColorSearch): ColorPhoto[] {
  return colorPhotos.filter((photo) => vividnessOf(photo, measure) >= vivid);
}

/** The photos of pool that match color. */
function photosOf(pool: ColorPhoto[], color: ColorName, match: ColorMatch): ColorPhoto[] {
  return pool.filter((photo) => matchesColor(photo.palette, color, match));
}

/** How many photos of pool each color's swatch would show. */
function countsFor(pool: ColorPhoto[], match: ColorMatch): Record<ColorName, number> {
  return Object.fromEntries(
    COLORS.map((color) => [color, photosOf(pool, color, match).length]),
  ) as Record<ColorName, number>;
}

/** How the page matches photos to a color, from the URL. */
function matchOf({ match, min = DEFAULT_PERCENT }: ColorSearch): ColorMatch {
  return match === "threshold" ? { mode: "threshold", minShare: min / 100 } : { mode: "largest" };
}

// The same columns as the Grid's square tiles.
const LIST_CLASS =
  "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

/** Photos browsed by their colors: every photo, or the ones with much of one hue bucket or shade. */
function ColorView() {
  const search = Route.useSearch();
  const { shown, show, close } = useShownPhoto();
  if (colorPhotos.length === 0) return <ViewPlaceholder to="/color" />;
  const { color } = search;
  const match = matchOf(search);
  const pool = vividPhotos(search);
  const listed = listedPhotos(pool, search, match);

  return (
    <div className="flex w-full flex-col gap-8 px-3 py-16 sm:px-4">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-1 sm:px-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <Palette className="size-8 text-muted-foreground" aria-hidden />
            Color
          </h1>
          <p className="text-sm text-muted-foreground">{countText(listed.length, color, match)}</p>
        </div>
        <ColorFilter color={color} counts={countsFor(pool, match)} />
        <ColorControls search={search} match={match} />
      </header>
      {search.view !== "grid" ? (
        <ColorWheel photos={listed} measure={search.measure ?? "average"} onOpen={show} />
      ) : (
        <ColorGrid photos={listed} onOpen={show} />
      )}
      <PhotoLightbox photo={shown} photos={listed} onShow={show} onClose={close} />
    </div>
  );
}

/** The photos of pool the page shows, those matching the picked color or every one, sorted as the URL asks. */
function listedPhotos(pool: ColorPhoto[], search: ColorSearch, match: ColorMatch): ColorPhoto[] {
  const matched = search.color ? photosOf(pool, search.color, match) : pool;
  return sortPhotos(matched, sortSpec(search));
}

/** How the URL asks for the photos to be sorted, with each default filled in. */
function sortSpec({
  color,
  sort = "color",
  order = "asc",
  secondary,
  secondaryOrder = "asc",
  measure = "average",
}: ColorSearch) {
  return { color, sort, order, secondary, secondaryOrder, measure };
}

/** What photos are sorted by and which way, how photos match a color, and the least vividness. */
function ColorControls({ search, match }: { search: ColorSearch; match: ColorMatch }) {
  const { min = DEFAULT_PERCENT, vivid = 0, measure = "average" } = search;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ColorLayoutControl wheel={search.view !== "grid"} />
        {search.view === "grid" && <ColorSortControl {...sortSpec(search)} />}
        <ColorMatchControl
          threshold={match.mode === "threshold"}
          percent={min}
          fallback={DEFAULT_PERCENT}
        />
      </div>
      <VividnessControl vivid={vivid} measure={measure} />
    </div>
  );
}

/** The photos as square tiles, each with its colors and vividness under it. */
function ColorGrid({
  photos,
  onOpen,
}: {
  photos: ColorPhoto[];
  onOpen: (photo: ColorPhoto) => void;
}) {
  return (
    <ul className={LIST_CLASS}>
      {photos.map((photo) => (
        <li key={photo.id}>
          <ColorTile photo={photo} onOpen={() => onOpen(photo)} />
        </li>
      ))}
    </ul>
  );
}

/** "24 photos", or with a color, "8 photos mostly orange" or "8 photos at least 30% orange". */
function countText(count: number, color: ColorName | undefined, match: ColorMatch): string {
  const photosText = `${count} ${count === 1 ? "photo" : "photos"}`;
  return color ? `${photosText} ${matchText(color, match)}` : photosText;
}

/** A photo's square thumbnail, opening it in the lightbox, with its colors under it. */
function ColorTile({ photo, onOpen }: { photo: ColorPhoto; onOpen: () => void }) {
  const { image } = photo;
  return (
    <figure className="flex flex-col gap-2">
      <button
        type="button"
        title="Show the whole photo"
        onClick={onOpen}
        className="relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <img
          src={image.thumbnail ?? image.small}
          alt={photo.title}
          loading="lazy"
          className="size-full object-cover"
        />
      </button>
      <figcaption className="flex flex-col gap-0.5">
        <ColorBar palette={photo.palette} />
        <p className="text-xs text-muted-foreground tabular-nums">
          Vividness {photo.vividness} · peak {photo.peakVividness}
        </p>
      </figcaption>
    </figure>
  );
}
