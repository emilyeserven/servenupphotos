import { shownTiers } from "@portfolio/lib/lower-tier";
import { type Photo, type PhotoEntry, photosFromData } from "@portfolio/lib/photos";

// ALLPHOTOS.local.json is made by `pnpm photos:local` (which `pnpm dev` runs) and git-ignored, so
// it's only there locally. A glob, unlike an import, doesn't fail when the file is missing.
const localData = Object.values(
  import.meta.glob<PhotoEntry[]>("../data/photos/ALLPHOTOS.local.json", {
    eager: true,
    import: "default",
  }),
)[0];

const localPhotos = localData ? photosFromData(localData) : [];

/**
 * The committed ALLPHOTOS.json. It's imported on its own, rather than with this module, so the
 * build puts it in a file of its own: the browser keeps it cached until the photo data changes, even
 * when the site's code does, and the other way round. Every module that reads `photos` waits for it
 * (a top-level await), so they all see the full list, as they did when it was built in.
 */
async function committedData(): Promise<PhotoEntry[]> {
  const data = await import("@portfolio/data/photos/ALLPHOTOS.json");
  return data.default as PhotoEntry[];
}

/**
 * The photos in ALLPHOTOS.local.json when there are any (the photos in flight, locally), or else
 * the photos in data/photos/ALLPHOTOS.json, which the "Combine photo data" workflow builds. Lower
 * Tier photos are left out unless **Show Lower Tier photos** is on on the Settings page.
 */
export const photos: Photo[] = shownTiers(
  localPhotos.length > 0 ? localPhotos : photosFromData(await committedData()),
);
