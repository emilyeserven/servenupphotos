import { createFileRoute } from "@tanstack/react-router";
import { Dices } from "lucide-react";
import { useState } from "react";
import { CameraFilterBar } from "@/components/camera-filters";
import { GridViewOptions } from "@/components/grid-view-options";
import { LuckyRowsSelect, ShuffleButton } from "@/components/lucky-controls";
import { NoMatchingPhotos } from "@/components/photo-filters";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { GridTiles, type ImagePhoto, type TileMode } from "@/components/photo-tiles";
import { SiteHomeLink } from "@/components/site-home-link";
import { ViewPlaceholder } from "@/components/view-placeholder";
import { TILE_SHAPES, ViewSwitcher } from "@/components/view-switcher";
import { type CameraFilters, filterWithCamera, parseCameraFilters } from "@/lib/camera-filters";
import { type ColorFilters, filterByColors, parseColorFilters } from "@/lib/color-search";
import { type GridSize, naturalSize, parseGridSize, squareSize } from "@/lib/grid-size";
import {
  DEFAULT_LUCKY_ROWS,
  type LuckyRows,
  newLuckySeed,
  parseLuckyRows,
  shuffled,
} from "@/lib/lucky";
import { parseFilters, type PhotoFilters } from "@/lib/photo-filters";
import { photos } from "@/lib/photos";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";
import { type LuckyDraw, useLuckyDraw } from "@/lib/use-lucky-draw";

interface LuckySearch extends ColorFilters {
  /** Set for tiles at each photo's own aspect ratio. Left out for the default, square tiles. */
  view?: "natural";
  /** Set when each tile shows its title, place and comment under it. Left out for hidden. */
  info?: true;
  /** How big the tiles are. Left out for Medium square tiles or Large natural ones. */
  size?: GridSize;
  /** How many rows of photos are drawn. Left out for the default, 3. */
  rows?: LuckyRows;
}

/** Reads the page's tile shape, size, info and rows, the filters and the open photo from the URL. */
function validateLuckySearch(
  search: Record<string, unknown>,
): LuckySearch & PhotoFilters & CameraFilters & ShownPhotoSearch {
  return {
    ...(search.view === "natural" ? { view: "natural" as const } : {}),
    ...(search.info === true ? { info: true as const } : {}),
    ...parseGridSize(search.size),
    ...parseLuckyRows(search.rows),
    ...parseColorFilters(search),
    ...parseFilters(search),
    ...parseCameraFilters(search),
    ...parseShownPhoto(search),
  };
}

export const Route = createFileRoute("/lucky")({
  validateSearch: validateLuckySearch,
  component: LuckyPage,
});

/** Every photo with resized versions in R2, which are the ones Lucky can draw. */
const withImages = photos.filter((photo): photo is ImagePhoto => photo.image !== null);

function LuckyPage() {
  if (withImages.length === 0) return <ViewPlaceholder to="/lucky" />;
  return <LuckyView />;
}

/**
 * Whole rows of photos picked at random from the ones the filters leave, drawn afresh on each
 * visit and each **Shuffle**.
 */
function LuckyView() {
  const search = Route.useSearch();
  const mode: TileMode = search.view ?? "square";
  const [seed, setSeed] = useState(newLuckySeed);
  const pool = filterByColors(filterWithCamera(withImages, search), search);
  const [ref, draw] = useLuckyDraw(shuffled(pool, seed), {
    mode,
    size: search.size,
    rows: search.rows,
  });

  return (
    <div className="flex w-full flex-col gap-8 px-3 py-16 sm:px-4">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-1 sm:px-2">
        <SiteHomeLink className="basis-full" />
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Dices className="size-8 text-muted-foreground" aria-hidden />
          Lucky
        </h1>
        <p className="text-sm text-muted-foreground">
          {draw.photos.length} random of {pool.length} photos
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 self-center">
          <LuckyControls
            search={search}
            mode={mode}
            draw={draw}
            onShuffle={() => setSeed(newLuckySeed())}
          />
        </div>
        <div className="mt-3 w-full">
          <CameraFilterBar photos={withImages} />
        </div>
      </header>
      <NoMatchingPhotos count={pool.length} className="mx-auto w-full max-w-6xl px-1 sm:px-2" />
      <div ref={ref}>
        <LuckyTiles draw={draw} mode={mode} search={search} />
      </div>
    </div>
  );
}

/** How many rows to draw, Shuffle, the tiles' display options and their shape. */
function LuckyControls({
  search,
  mode,
  draw,
  onShuffle,
}: {
  search: LuckySearch;
  mode: TileMode;
  draw: LuckyDraw;
  onShuffle: () => void;
}) {
  const size = mode === "natural" ? naturalSize(search.size) : squareSize(search.size);
  return (
    <>
      <LuckyRowsSelect rows={search.rows ?? DEFAULT_LUCKY_ROWS} choices={draw.choices} />
      <ShuffleButton onShuffle={onShuffle} />
      <GridViewOptions view={mode} size={size} info={search.info === true} />
      <ViewSwitcher choices={TILE_SHAPES} mode={mode} />
    </>
  );
}

/** The drawn photos as tiles, with the photo viewer moving through them. */
function LuckyTiles({
  draw,
  mode,
  search,
}: {
  draw: LuckyDraw;
  mode: TileMode;
  search: LuckySearch;
}) {
  const { shown, show, close } = useShownPhoto();
  return (
    <>
      <GridTiles
        photos={draw.photos}
        rows={draw.rows}
        mode={mode}
        size={search.size}
        showInfo={search.info === true}
        onOpen={show}
      />
      <PhotoLightbox photo={shown} photos={draw.photos} onShow={show} onClose={close} />
    </>
  );
}
