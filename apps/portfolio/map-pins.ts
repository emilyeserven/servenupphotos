import path from "node:path";
import { type Plugin, runnerImport } from "vite";
import type { Photo } from "./src/lib/photos";

/**
 * One photo on the map, as the map preview Worker reads it: its longitude and latitude, rounded to
 * about a meter, and its average color, or null before the pipeline saves its colors.
 */
type MapPin = [number, number, string | null];

/** Rounds a coordinate to 5 decimal places, about a meter. */
function rounded(n: number): number {
  return Number(n.toFixed(5));
}

/** The photos with a position on the map, as pins. */
function pinsOf(photos: Photo[]): MapPin[] {
  return photos.flatMap(({ longitude, latitude, averageColor }) =>
    longitude === null || latitude === null
      ? []
      : [[rounded(longitude), rounded(latitude), averageColor]],
  );
}

/**
 * Adds `map-pins.json` to the built site: where every photo on the map is, for the Cloudflare
 * Worker that draws the preview images of map links (see docs/map-link-previews.md). It reads the
 * photos the same way the map does, through `src/lib/photos.ts`, so custom and place positions
 * count too.
 */
export function mapPins(): Plugin {
  const root = import.meta.dirname;
  return {
    name: "map-pins",
    apply: "build",
    async generateBundle() {
      const { module } = await runnerImport<{ photos: Photo[] }>(
        path.join(root, "src/lib/photos.ts"),
        {
          configFile: false,
          root,
          logLevel: "error",
          resolve: { alias: { "@portfolio": path.join(root, "src"), "@": path.join(root, "src") } },
        },
      );
      this.emitFile({
        type: "asset",
        fileName: "map-pins.json",
        source: JSON.stringify(pinsOf(module.photos)),
      });
    },
  };
}
