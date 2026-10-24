import { createFileRoute } from "@tanstack/react-router";
import { Palette } from "lucide-react";
import { HueBar } from "@/components/hue-bar";
import { HueFilter } from "@/components/hue-filter";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { parseThreshold, ShareThreshold } from "@/components/share-threshold";
import { ViewPlaceholder } from "@/components/view-placeholder";
import {
  HUE_BUCKETS,
  type HueBucket,
  hueLabel,
  hueShareOf,
  isHueBucket,
  percent,
} from "@/lib/photo-colors";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";

interface ColorSearch {
  /** The hue bucket to show photos of; left out to show every photo. */
  hue?: HueBucket;
  /** How much of a photo's colors, in percent, the hue needs; left out for DEFAULT_PERCENT. */
  min?: number;
}

export const Route = createFileRoute("/color")({
  validateSearch: (search: Record<string, unknown>): ColorSearch & ShownPhotoSearch => ({
    ...(isHueBucket(search.hue) ? { hue: search.hue } : {}),
    ...minOf(search.min),
    ...parseShownPhoto(search),
  }),
  component: ColorView,
});

/** A photo with resized versions in R2 and its colors saved, which is all this page can show. */
type ColorPhoto = Photo & { image: PhotoImage };

/**
 * How much of a photo's colors, in percent, a hue needs by default for the photo to show under its
 * filter, so a photo shows for its main colors, not every speck. The page's slider changes it.
 */
const DEFAULT_PERCENT = 30;

/** The `?min=` to keep, leaving it out when it's missing or not one the slider can set. */
function minOf(value: unknown): ColorSearch {
  const min = parseThreshold(value);
  return min === undefined ? {} : { min };
}

// Newest first.
const colorPhotos = photos
  .filter((photo): photo is ColorPhoto => photo.image !== null && photo.hues.length > 0)
  .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());

/** The photos with at least minShare (0–1) of their colors in hue, the most first. */
function photosOf(hue: HueBucket, minShare: number): ColorPhoto[] {
  return colorPhotos
    .filter((photo) => hueShareOf(photo.hues, hue) >= minShare)
    .sort((a, b) => hueShareOf(b.hues, hue) - hueShareOf(a.hues, hue));
}

/** How many photos each hue's swatch would show at minShare. */
function countsAt(minShare: number): Record<HueBucket, number> {
  return Object.fromEntries(
    HUE_BUCKETS.map((hue) => [hue, photosOf(hue, minShare).length]),
  ) as Record<HueBucket, number>;
}

// The same columns as the Grid's square tiles.
const LIST_CLASS =
  "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

/** Photos browsed by their colors: every photo, or the ones with much of one hue bucket. */
function ColorView() {
  const { hue, min = DEFAULT_PERCENT } = Route.useSearch();
  const { shown, show, close } = useShownPhoto();
  if (colorPhotos.length === 0) return <ViewPlaceholder to="/color" />;
  const minShare = min / 100;
  const listed = hue ? photosOf(hue, minShare) : colorPhotos;

  return (
    <div className="flex w-full flex-col gap-8 px-3 py-16 sm:px-4">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-1 sm:px-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <Palette className="size-8 text-muted-foreground" aria-hidden />
            Color
          </h1>
          <p className="text-sm text-muted-foreground">{countText(listed.length, hue, minShare)}</p>
        </div>
        <HueFilter hue={hue} counts={countsAt(minShare)} />
        <ShareThreshold percent={min} fallback={DEFAULT_PERCENT} />
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

/** "24 photos", or with a hue, "8 photos at least 30% orange". */
function countText(count: number, hue: HueBucket | undefined, minShare: number): string {
  const photosText = `${count} ${count === 1 ? "photo" : "photos"}`;
  if (!hue) return photosText;
  return `${photosText} at least ${percent(minShare)} ${hueLabel(hue).toLowerCase()}`;
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
        <HueBar hues={photo.hues} />
      </figcaption>
    </figure>
  );
}
