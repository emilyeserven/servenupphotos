import { albumAndSubAlbums, albums, type Group } from "@/lib/groups";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";

/** A photo with resized versions in R2, which is all a spotlight zone can show. */
export type ImagePhoto = Photo & { image: PhotoImage };

/** The spotlight zone the homepage's background shows. */
export const HOMEPAGE_ZONE = "homepage";

/** What each spotlight zone is called, by ID, for the Albums page to say where an album shows. */
const ZONE_LABELS: Record<string, string> = { [HOMEPAGE_ZONE]: "the homepage" };

/** The photos with images, newest first. */
export function newestWithImages(all: Photo[]): ImagePhoto[] {
  return all
    .filter((photo): photo is ImagePhoto => photo.image !== null)
    .toSorted((a, b) => b.takenAt.getTime() - a.takenAt.getTime());
}

/** Ranks a photo without an old spotlight place after every photo with one. */
function rank({ spotlightPlace }: Photo): number {
  return spotlightPlace ?? Number.MAX_SAFE_INTEGER;
}

/**
 * The photos with images in the album with the ID or one of its sub-albums: the ones with an old
 * spotlight place first, in that order, then the rest, newest first.
 */
export function albumPhotos(id: string, all: Photo[] = photos): ImagePhoto[] {
  const ids = albumAndSubAlbums(id);
  return newestWithImages(all)
    .filter((photo) => photo.albums.some((album) => ids.has(album)))
    .toSorted((a, b) => rank(a) - rank(b));
}

/** The album picked for the zone on the pipeline's Site Spotlight page, or undefined for none. */
function zoneAlbum(zone: string): Group | undefined {
  return albums.find((album) => album.spotlightZones?.includes(zone));
}

/**
 * The photos the zone shows: the ones in the album picked for it on the pipeline's Site Spotlight
 * page and its sub-albums, in the album's order; none when no album is picked.
 */
export function zonePhotos(zone: string, all: Photo[] = photos): ImagePhoto[] {
  const album = zoneAlbum(zone);
  return album ? albumPhotos(album.id, all) : [];
}

/** Where on the site the album's photos show, such as "the homepage"; empty for nowhere. */
export function albumSpots(album: Group): string[] {
  return (album.spotlightZones ?? []).flatMap((zone) => ZONE_LABELS[zone] ?? []);
}
