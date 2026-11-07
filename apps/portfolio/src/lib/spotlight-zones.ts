import { albumAndSubAlbums, albums, type Group } from "@/lib/groups";
import { photos, type Photo, type PhotoImage, type ZoneFocus } from "@/lib/photos";

/** A photo with resized versions in R2, which is all a spotlight zone can show. */
export type ImagePhoto = Photo & { image: PhotoImage };

/** The spotlight zone the homepage's background shows. */
export const HOMEPAGE_ZONE = "homepage";

/** The spotlight zone above the Timeline's title. */
export const TIMELINE_HEADER_ZONE = "timeline-header";

/** The spotlight zone above the Grid's title and filters. */
export const GRID_HEADER_ZONE = "grid-header";

/** What each spotlight zone is called, by ID, for the Albums page to say where an album shows. */
const ZONE_LABELS: Record<string, string> = {
  [HOMEPAGE_ZONE]: "the homepage",
  [TIMELINE_HEADER_ZONE]: "the Timeline's header",
  [GRID_HEADER_ZONE]: "the Grid's header",
};

/**
 * A phone held upright, where a zone that matches the screen puts portrait photos first; every
 * other screen gets landscape photos first.
 */
export const UPRIGHT_PHONE_QUERY = "(max-width: 767px) and (orientation: portrait)";

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

/** The photo's place in the album's photo order, or after every photo it lists. */
function placeIn(order: readonly number[], { id }: Photo): number {
  const place = order.indexOf(id);
  return place === -1 ? Number.MAX_SAFE_INTEGER : place;
}

/** The photo order set for the album with the ID on the pipeline's album page; empty for none. */
function photoOrder(id: string): number[] {
  return albums.find((album) => album.id === id)?.photoOrder ?? [];
}

/**
 * The photos with images in the album with the ID or one of its sub-albums, in the album's order:
 * the ones its photo order lists first, in that order, then the ones with an old spotlight place,
 * in that order, then the rest, newest first.
 */
export function albumPhotos(id: string, all: Photo[] = photos): ImagePhoto[] {
  const ids = albumAndSubAlbums(id);
  const order = photoOrder(id);
  return newestWithImages(all)
    .filter((photo) => photo.albums.some((album) => ids.has(album)))
    .toSorted((a, b) => placeIn(order, a) - placeIn(order, b) || rank(a) - rank(b));
}

/** The album picked for the zone on the pipeline's Site Spotlight page, or undefined for none. */
function zoneAlbum(zone: string): Group | undefined {
  return albums.find((album) => album.spotlightZones?.includes(zone));
}

/**
 * The photos the zone shows: the ones in the album picked for it on the pipeline's Site Spotlight
 * page and its sub-albums, in the album's order; none when no album is picked.
 */
function zonePhotos(zone: string, all: Photo[] = photos): ImagePhoto[] {
  const album = zoneAlbum(zone);
  return album ? albumPhotos(album.id, all) : [];
}

/**
 * Whether the zone puts the photos that fit the screen's shape first, as set on the pipeline's
 * Site Spotlight page: true unless the album picked for it says "none", and true with no album.
 */
function matchesScreen(zone: string): boolean {
  return zoneAlbum(zone)?.spotlightOrientation?.[zone] !== "none";
}

/** Whether the photo is taller than it's wide, as it's shown. */
function isPortrait({ image }: ImagePhoto): boolean {
  return image.height > image.width;
}

/**
 * The list as the zone shows it on a phone held upright (`phone`) or a wider screen: when the zone
 * matches the screen, portrait photos first on the phone and landscape photos first elsewhere,
 * each part keeping its order; otherwise as it is.
 */
export function arranged(list: ImagePhoto[], zone: string, phone: boolean): ImagePhoto[] {
  if (!matchesScreen(zone)) return list;
  const first = list.filter((photo) => isPortrait(photo) === phone);
  return [...first, ...list.filter((photo) => isPortrait(photo) !== phone)];
}

/** The zone's photos as it shows them on a phone held upright (`phone`) or a wider screen. */
export function spotlightPhotos(zone: string, phone: boolean, all: Photo[] = photos): ImagePhoto[] {
  return arranged(zonePhotos(zone, all), zone, phone);
}

/** Where on the site the album's photos show, such as "the homepage"; empty for nowhere. */
export function albumSpots(album: Group): string[] {
  return (album.spotlightZones ?? []).flatMap((zone) => ZONE_LABELS[zone] ?? []);
}

/**
 * The photo's focus point and placement in the zone: its own for the zone, set on the pipeline's
 * Site Spotlight page, or else the one it had before zones had their own.
 */
export function focusIn(photo: Photo, zone: string): ZoneFocus {
  return (
    photo.zoneFocus[zone] ?? { focus: photo.spotlightFocus, placement: photo.spotlightPlacement }
  );
}
