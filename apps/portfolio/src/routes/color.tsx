import { createFileRoute, redirect } from "@tanstack/react-router";
import { Palette } from "lucide-react";
import { type ColorLayout, ColorLayoutControl } from "@/components/color-layout-control";
import { ColorViewFilters } from "@/components/color-view-filters";
import { ColorWheel } from "@/components/color-wheel";
import { PinSizeControl } from "@/components/pin-size-control";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { ShadeSpectrum } from "@/components/shade-spectrum";
import { ViewPlaceholder } from "@/components/view-placeholder";
import { type ColorFilters, parseColorFilters, vividEnough } from "@/lib/color-search";
import { isBlackAndWhite } from "@/lib/photo-colors";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import {
  inLightness,
  lightnessExtent,
  lightnessRange,
  parseLightness,
} from "@/lib/lightness-range";
import { parsePinScale, pinFactor, type PinScale } from "@/lib/pin-scale";
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
  /** How big the photo previews are: left out for small. */
  pins?: Exclude<PinScale, "small">;
}

export const Route = createFileRoute("/color")({
  validateSearch: (search: Record<string, unknown>): ColorSearch & ShownPhotoSearch => ({
    ...parseColorFilters(search),
    ...viewOf(search.view),
    ...lightOf(search.light),
    ...pinsOf(search.pins),
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

/** The `?pins=` to keep, leaving it out when it's missing or not a size. */
function pinsOf(value: unknown): ColorSearch {
  const pins = parsePinScale(value);
  return pins === undefined ? {} : { pins };
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
  const shownPhotos = photosFor(search, layout);

  return (
    // The page fills the window, so the wheel or chart can take all the room under the header.
    <div className="flex h-svh min-h-[34rem] w-full flex-col gap-4 px-3 pt-16 pb-4 sm:px-4">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-1 sm:px-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <Palette className="size-8 text-muted-foreground" aria-hidden />
            Color
          </h1>
          <p className="text-sm text-muted-foreground">{countText(shownPhotos.length)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          <ColorLayoutControl layout={layout} />
          <PinSizeControl scale={search.pins} />
          <ColorViewFilters vivid={search.vivid} measure={search.measure} />
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <ColorLayoutView layout={layout} photos={shownPhotos} search={search} onOpen={show} />
      </div>
      <PhotoLightbox photo={shown} photos={shownPhotos} onShow={show} onClose={close} />
    </div>
  );
}

/** The photos the layout shows: the color ones on the wheel, or the black and white ones on the chart. */
function photosFor(search: ColorSearch, layout: ColorLayout): ColorPhoto[] {
  return layout === "mono" ? monoShown(search) : vividEnough(wheelPhotos, search);
}

// The photos with color, for the wheel.
const wheelPhotos = colorPhotos.filter((photo) => !isBlackAndWhite(photo.palette));

// The black and white photos, darkest first, for the Black & white view.
const monoPhotos = colorPhotos
  .filter((photo) => isBlackAndWhite(photo.palette))
  .toSorted((a, b) => lightnessOf(a) - lightnessOf(b));

// The range of lightness the black and white photos cover, the Black & white chart's ends.
const MONO_EXTENT = lightnessExtent(monoPhotos.map(lightnessOf));

/** A photo's average lightness, the middle gray when it has none saved. */
function lightnessOf(photo: ColorPhoto): number {
  return photo.lightness ?? 50;
}

/** The black and white photos the Black & white chart shows: as vivid as the slider asks, in the picked range of lightness. */
function monoShown(search: ColorSearch): ColorPhoto[] {
  const range = lightnessRange(search.light, MONO_EXTENT);
  return vividEnough(monoPhotos, search).filter((photo) => inLightness(lightnessOf(photo), range));
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
  const scale = pinFactor(search.pins);
  if (layout === "mono") {
    return (
      <ShadeSpectrum
        photos={photos}
        measure={measure}
        range={lightnessRange(search.light, MONO_EXTENT)}
        extent={MONO_EXTENT}
        scale={scale}
        onOpen={onOpen}
      />
    );
  }
  return <ColorWheel photos={photos} measure={measure} scale={scale} onOpen={onOpen} />;
}

/** "24 photos", or "1 photo". */
function countText(count: number): string {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}
