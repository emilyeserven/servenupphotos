import { createFileRoute } from "@tanstack/react-router";
import { Palette } from "lucide-react";
import { ColorBar } from "@/components/color-bar";
import { ColorFilter } from "@/components/color-filter";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { ColorMatchControl, parseThreshold } from "@/components/color-match-control";
import { ColorOrderControl } from "@/components/color-order-control";
import { ViewPlaceholder } from "@/components/view-placeholder";
import { type ColorMatch, matchesColor, matchText } from "@/lib/color-match";
import { type ColorOrder, sortByColor } from "@/lib/color-sort";
import { COLORS, type ColorName, isColorName, shareOf } from "@/lib/photo-colors";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";

interface ColorSearch {
  /** The hue bucket or shade to show photos of; left out to show every photo. */
  color?: ColorName;
  /** Set to match photos by a share of the color; left out to match the photos it's the largest color of. */
  match?: "threshold";
  /** How much of a photo, in percent, the color needs to match by share; left out for DEFAULT_PERCENT. */
  min?: number;
  /** Set to sort every photo from white back to red when no color is picked; left out for red to white. */
  order?: "desc";
}

export const Route = createFileRoute("/color")({
  validateSearch: (search: Record<string, unknown>): ColorSearch & ShownPhotoSearch => ({
    ...(isColorName(search.color) ? { color: search.color } : {}),
    ...(search.match === "threshold" ? { match: "threshold" as const } : {}),
    ...minOf(search.min),
    ...(search.order === "desc" ? { order: "desc" as const } : {}),
    ...parseShownPhoto(search),
  }),
  component: ColorView,
});

/** A photo with resized versions in R2 and its colors saved, which is all this page can show. */
type ColorPhoto = Photo & { image: PhotoImage };

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

// Newest first, so photos of the same color stay newest first when sorted by color.
const colorPhotos = photos
  .filter((photo): photo is ColorPhoto => photo.image !== null && photo.palette.length > 0)
  .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());

/** Every photo sorted around the color wheel, each way. */
const byColor: Record<ColorOrder, ColorPhoto[]> = {
  asc: sortByColor(colorPhotos, "asc"),
  desc: sortByColor(colorPhotos, "desc"),
};

/** The photos that match color, the most of it first. */
function photosOf(color: ColorName, match: ColorMatch): ColorPhoto[] {
  return colorPhotos
    .filter((photo) => matchesColor(photo.palette, color, match))
    .sort((a, b) => shareOf(b.palette, color) - shareOf(a.palette, color));
}

/** How many photos each color's swatch would show. */
function countsFor(match: ColorMatch): Record<ColorName, number> {
  return Object.fromEntries(
    COLORS.map((color) => [color, photosOf(color, match).length]),
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
  const listed = listedPhotos(search, match);

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
        <ColorFilter color={color} counts={countsFor(match)} />
        <ColorControls search={search} match={match} />
      </header>
      <ul className={LIST_CLASS}>
        {listed.map((photo) => (
          <li key={photo.id}>
            <ColorTile photo={photo} onOpen={() => show(photo)} />
          </li>
        ))}
      </ul>
      <PhotoLightbox photo={shown} photos={listed} onShow={show} onClose={close} />
    </div>
  );
}

/** The photos the page shows: those matching the picked color, or every photo sorted by color. */
function listedPhotos({ color, order }: ColorSearch, match: ColorMatch): ColorPhoto[] {
  return color ? photosOf(color, match) : byColor[order ?? "asc"];
}

/** Which way every photo is sorted by color, shown only without a color picked, and how photos match one. */
function ColorControls({ search, match }: { search: ColorSearch; match: ColorMatch }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {!search.color && <ColorOrderControl order={search.order ?? "asc"} />}
      <ColorMatchControl
        threshold={match.mode === "threshold"}
        percent={search.min ?? DEFAULT_PERCENT}
        fallback={DEFAULT_PERCENT}
      />
    </div>
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
      <figcaption>
        <ColorBar palette={photo.palette} />
      </figcaption>
    </figure>
  );
}
