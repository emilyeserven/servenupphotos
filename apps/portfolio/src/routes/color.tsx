import { createFileRoute, redirect } from "@tanstack/react-router";
import { Palette } from "lucide-react";
import type { ReactNode } from "react";
import { ColorFilter } from "@/components/color-filter";
import { type ColorLayout, ColorLayoutControl } from "@/components/color-layout-control";
import { ColorMatchControl } from "@/components/color-match-control";
import { ColorWheel } from "@/components/color-wheel";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { ShadeSpectrum } from "@/components/shade-spectrum";
import { ViewPlaceholder } from "@/components/view-placeholder";
import { VividnessControl } from "@/components/vividness-control";
import { type ColorMatch, matchText } from "@/lib/color-match";
import {
  type ColorFilters,
  countsFor,
  DEFAULT_PERCENT,
  filterByColors,
  matchOf,
  parseColorFilters,
  vividEnough,
} from "@/lib/color-search";
import { type ColorName, isBlackAndWhite } from "@/lib/photo-colors";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { inLightness, lightnessRange, parseLightness } from "@/lib/lightness-range";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";

interface ColorSearch extends ColorFilters {
  /**
   * Set to show the black and white photos along a spectrum from black to white; left out for
   * the color photos on the color wheel. "grid" is only read from older links, which go to the
   * Grid page.
   */
  view?: Exclude<ColorLayout, "wheel"> | "grid";
  /**
   * The range of lightness the Black & white view shows, such as "20-60", from 0 (black) to 100
   * (white); left out for the whole spectrum.
   */
  light?: string;
}

export const Route = createFileRoute("/color")({
  validateSearch: (search: Record<string, unknown>): ColorSearch & ShownPhotoSearch => ({
    ...parseColorFilters(search),
    ...viewOf(search.view),
    ...lightOf(search.light),
    ...parseShownPhoto(search),
  }),
  // The Color page's grid moved to the Grid page, sorted by color, with the same color filters.
  beforeLoad: ({ search }) => {
    if (search.view !== "grid") return;
    throw redirect({ to: "/grid", search: { ...parseColorFilters(search), sort: "color" } });
  },
  component: ColorView,
});

/** A photo with resized versions in R2 and its colors saved, which is all this page can show. */
type ColorPhoto = Photo & { image: PhotoImage; vividness: number; peakVividness: number };

/** The `?view=` to keep: the Black & white view, or the grid from older links. */
function viewOf(view: unknown): ColorSearch {
  return view === "mono" || view === "grid" ? { view } : {};
}

/** The `?light=` to keep, leaving it out when it's missing or not a range the slider can set. */
function lightOf(value: unknown): ColorSearch {
  const light = parseLightness(value);
  return light === undefined ? {} : { light };
}

// Newest first.
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

/** Photos browsed by their colors: every photo, or the ones with much of one hue bucket or shade. */
function ColorView() {
  const search = Route.useSearch();
  const { shown, show, close } = useShownPhoto();
  if (colorPhotos.length === 0) return <ViewPlaceholder to="/color" />;
  const layout = search.view === "mono" ? "mono" : "wheel";
  const { photos: shownPhotos, count, filter, controls } = pageFor(search, layout);

  return (
    <div className="flex w-full flex-col gap-8 px-3 py-16 sm:px-4">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-1 sm:px-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <Palette className="size-8 text-muted-foreground" aria-hidden />
            Color
          </h1>
          <p className="text-sm text-muted-foreground">{count}</p>
        </div>
        {filter}
        <div className="flex flex-col items-start gap-3">
          <ColorLayoutControl layout={layout} />
          {controls}
        </div>
      </header>
      <ColorLayoutView layout={layout} photos={shownPhotos} search={search} onOpen={show} />
      <PhotoLightbox photo={shown} photos={shownPhotos} onShow={show} onClose={close} />
    </div>
  );
}

/** What the page shows for a layout: its photos, how many, its swatches and its other controls. */
interface ColorPage {
  photos: ColorPhoto[];
  count: string;
  filter: ReactNode;
  controls: ReactNode;
}

/** What the page shows for the layout. */
function pageFor(search: ColorSearch, layout: ColorLayout): ColorPage {
  return layout === "mono" ? monoPage(search) : wheelPage(search);
}

/**
 * The wheel's page: the color photos matching the picked color and vividness, leaving out the
 * black and white ones, with the color swatches and their controls.
 */
function wheelPage(search: ColorSearch): ColorPage {
  const match = matchOf(search);
  const pool = vividEnough(wheelPhotos, search);
  const listed = filterByColors(wheelPhotos, search);
  return {
    photos: listed,
    count: countText(listed.length, search.color, match),
    filter: <ColorFilter color={search.color} counts={countsFor(pool, match)} />,
    controls: <ColorControls search={search} match={match} />,
  };
}

// The photos with color, for the wheel.
const wheelPhotos = colorPhotos.filter((photo) => !isBlackAndWhite(photo.palette));

// The black and white photos, darkest first, for the Black & white view.
const monoPhotos = colorPhotos
  .filter((photo) => isBlackAndWhite(photo.palette))
  .toSorted((a, b) => lightnessOf(a) - lightnessOf(b));

/** A photo's average lightness, the middle gray when it has none saved. */
function lightnessOf(photo: ColorPhoto): number {
  return photo.lightness ?? 50;
}

/**
 * The Black & white view's page: the black and white photos as vivid as the slider asks, in the
 * picked range of lightness, with the vividness controls, as they place photos up the chart.
 */
function monoPage(search: ColorSearch): ColorPage {
  const range = lightnessRange(search.light);
  const shown = vividEnough(monoPhotos, search).filter((photo) =>
    inLightness(lightnessOf(photo), range),
  );
  const { vivid = 0, measure = "average" } = search;
  return {
    photos: shown,
    count: countText(shown.length, undefined, { mode: "largest" }),
    filter: null,
    controls: <VividnessControl vivid={vivid} measure={measure} />,
  };
}

/** The photos on the color wheel, or the black-to-white chart. */
function ColorLayoutView({
  layout,
  photos,
  search,
  onOpen,
}: {
  layout: ColorLayout;
  photos: ColorPhoto[];
  search: ColorSearch;
  onOpen: (photo: ColorPhoto) => void;
}) {
  const measure = search.measure ?? "average";
  if (layout === "mono") {
    return (
      <ShadeSpectrum
        photos={photos}
        measure={measure}
        range={lightnessRange(search.light)}
        onOpen={onOpen}
      />
    );
  }
  return <ColorWheel photos={photos} measure={measure} onOpen={onOpen} />;
}

/** How photos match a color, and the least vividness. */
function ColorControls({ search, match }: { search: ColorSearch; match: ColorMatch }) {
  const { min = DEFAULT_PERCENT, vivid = 0, measure = "average" } = search;
  return (
    <div className="flex flex-col gap-3">
      <ColorMatchControl
        threshold={match.mode === "threshold"}
        percent={min}
        fallback={DEFAULT_PERCENT}
      />
      <VividnessControl vivid={vivid} measure={measure} />
    </div>
  );
}

/** "24 photos", or with a color, "8 photos mostly orange" or "8 photos at least 30% orange". */
function countText(count: number, color: ColorName | undefined, match: ColorMatch): string {
  const photosText = `${count} ${count === 1 ? "photo" : "photos"}`;
  return color ? `${photosText} ${matchText(color, match)}` : photosText;
}
