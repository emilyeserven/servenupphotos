import committedData from "@portfolio/data/photos/ALLPHOTOS.json";
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
 * The photos in ALLPHOTOS.local.json when there are any (the photos in flight, locally), or else
 * the photos in data/photos/ALLPHOTOS.json, which the "Combine photo data" workflow builds. Lower
 * Tier photos are left out unless **Show Lower Tier photos** is on on the Settings page.
 */
export const photos: Photo[] = shownTiers(
  localPhotos.length > 0 ? localPhotos : photosFromData(committedData as PhotoEntry[]),
);
