import { useSearch } from "@tanstack/react-router";
import { useMemo } from "react";
import { CameraFilterBar } from "@portfolio/components/camera-filters";
import { GridColorFilters } from "@portfolio/components/grid-color-filters";
import { ScriptDisplayProvider } from "@portfolio/components/script-display-provider";
import {
  CAMERA_FILTER_KEYS,
  type CameraFilters,
  filterWithCamera,
  parseCameraFilters,
} from "@portfolio/lib/camera-filters";
import {
  COLOR_FILTER_KEYS,
  type ColorFilters,
  colorFilterCount,
  filterByColors,
  parseColorFilters,
} from "@portfolio/lib/color-search";
import {
  FILTER_KEYS,
  type PhotoFilters,
  filterCount,
  parseFilters,
} from "@portfolio/lib/photo-filters";
import { type Photo, photosFromData } from "@portfolio/lib/photos";
import type { PublishedFile } from "@/api/photos";
import { Card, CardContent } from "@/components/ui/card";
import { editedData } from "@/lib/undecided";
import { type LocalEdit, useLocalEditsStore } from "@/stores/local-edits";

/**
 * The portfolio Grid's filters as the Gallery keeps them in the URL: places, album, tag and genre,
 * camera, lens, the setting and time of day sliders, and colors.
 */
export type GridFilters = PhotoFilters & CameraFilters & ColorFilters;

/** The search params the Grid's filters are kept in, which the Gallery's Clear filters clears too. */
export const GRID_FILTER_PARAMS: readonly string[] = [
  ...FILTER_KEYS,
  ...CAMERA_FILTER_KEYS,
  ...COLOR_FILTER_KEYS,
];

/** The Grid's filters in the Gallery's search params, leaving out anything else. */
export function parseGridFilters(search: Record<string, unknown>): GridFilters {
  return { ...parseFilters(search), ...parseCameraFilters(search), ...parseColorFilters(search) };
}

/** How many of the Grid's filters are set. */
function gridFilterCount(search: Record<string, unknown>): number {
  const camera = Object.keys(parseCameraFilters(search)).length;
  return filterCount(parseFilters(search)) + camera + colorFilterCount(parseColorFilters(search));
}

/** A photo JSON entry as the portfolio reads it. */
type PhotoData = Parameters<typeof photosFromData>[0][number];

/** The Gallery's photos as the portfolio reads them, and which file each one is, by its ID. */
interface GalleryPhotos {
  photos: Photo[];
  paths: Map<number, string>;
}

/** The ID a photo goes by here: its own, or a negative one when it has none or shares one. */
function uniqueId(id: unknown, index: number, seen: Set<number>): number {
  const own = typeof id === "number" && !seen.has(id) ? id : -(index + 1);
  seen.add(own);
  return own;
}

/**
 * The files as the portfolio reads its photos, with the local edits made. A file whose JSON
 * couldn't be read, or that has no date, has no photo, so the Grid's filters never show it.
 */
function galleryPhotos(files: PublishedFile[], edits: Record<string, LocalEdit>): GalleryPhotos {
  const seen = new Set<number>();
  const entries = files.flatMap((file, index) => {
    const data = editedData(file, edits);
    if (typeof data !== "object" || data === null) return [];
    const photo = { ...data, id: uniqueId((data as PhotoData).id, index, seen) } as PhotoData;
    return [{ path: file.path, photo }];
  });
  return {
    photos: photosFromData(entries.map(({ photo }) => photo)),
    paths: new Map(entries.map(({ path, photo }) => [photo.id as number, path])),
  };
}

/**
 * The portfolio Grid's filters on the Gallery: the photos of `files` (some of `all`, the Gallery's
 * every file), which the filters' counts are out of, and the files the URL's filters leave, in the
 * same order. While none is set, every file is left, even one the portfolio couldn't place in time.
 */
export function useGridFilters(all: PublishedFile[], files: PublishedFile[]) {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const edits = useLocalEditsStore((s) => s.edits);
  const { photos: every, paths } = useMemo(() => galleryPhotos(all, edits), [all, edits]);
  const listed = new Set(files.map(({ path }) => path));
  const photos = every.filter(({ id }) => listed.has(paths.get(id) ?? ""));
  const count = gridFilterCount(search);
  if (count === 0) return { photos, count, shown: files };
  const kept = new Set(
    filterByColors(filterWithCamera(photos, search), search).map(({ id }) => paths.get(id)),
  );
  return { photos, count, shown: files.filter((file) => kept.has(file.path)) };
}

/**
 * The portfolio Grid's **Show filters** button and panel, the same filters as there: places,
 * album, tag, genre, camera, lens, the setting and time of day sliders, and colors. `photos` is
 * what the Gallery's other filters leave, which the counts are out of.
 */
export function GridFilterBar({ photos }: { photos: Photo[] }) {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  if (photos.length === 0) return null;
  return (
    <ScriptDisplayProvider>
      <Card className="py-4">
        <CardContent className="px-4 text-sm">
          <CameraFilterBar
            photos={photos}
            extra={{
              keys: COLOR_FILTER_KEYS,
              count: colorFilterCount(parseColorFilters(search)),
              children: (
                <GridColorFilters
                  photos={filterWithCamera(photos, search)}
                  filters={parseColorFilters(search)}
                />
              ),
            }}
          />
        </CardContent>
      </Card>
    </ScriptDisplayProvider>
  );
}
