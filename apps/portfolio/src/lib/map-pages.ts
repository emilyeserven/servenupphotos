import { placeById } from "@/lib/localize";
import { fitView, type MapView } from "@/lib/map-preview-view";
import { photos, type Photo } from "@/lib/photos";

/**
 * The map's shareable pages (see docs/map-link-previews.md): one for every country, state, city and
 * place with photos on the map, and one for every photo. The build writes each with a picture of
 * its view as the link preview; in the app each opens the map on that view.
 */

/** A photo with a position on the map. */
type MapPhoto = Photo & { latitude: number; longitude: number };

/** The kinds of place a map page can be for, as the Places filter names them. */
type PlaceKind = "country" | "state" | "city" | "place";

/** One of the map's shareable pages. */
export interface MapPage {
  /** Its address, such as `/maps/city/seoul/`. */
  path: string;
  /** What it shows, such as "Seoul", or "Every photo" for the whole map. */
  name: string;
  /** The photos it's fitted to. */
  photos: MapPhoto[];
  /** Where the map looks, the same view its preview image shows. */
  view: MapView;
  /** Whether it's the whole map's page rather than a place's. */
  whole: boolean;
}

/** The page for every photo, and the address the map's Copy link falls back to. */
const ALL_PHOTOS_PATH = "/maps/all/";

/** A name as it goes in an address: lowercase letters and digits with dashes, or else encoded. */
function slugOf(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ascii || encodeURIComponent(name);
}

/** One of the places a photo is in: its kind, its name, and the part of its address after its kind. */
interface PhotoPlace {
  kind: PlaceKind;
  name: string;
  slug: string;
}

/** The country, state or city a photo is in, when it says. */
function fieldPlace(photo: Photo, kind: "country" | "state" | "city"): PhotoPlace[] {
  const name = photo[kind];
  return name ? [{ kind, name, slug: slugOf(name) }] : [];
}

/** A place on the Places page a photo is in, by its ID. */
function placeOf(id: string): PhotoPlace[] {
  const place = placeById(id);
  return place ? [{ kind: "place", name: place.name, slug: id }] : [];
}

/** Every place a photo is in, most specific first: its places, then its city, state and country. */
function placesOf(photo: Photo): PhotoPlace[] {
  return [
    ...photo.placeIds.flatMap(placeOf),
    ...fieldPlace(photo, "city"),
    ...fieldPlace(photo, "state"),
    ...fieldPlace(photo, "country"),
  ];
}

/** The address of a place's page. */
function pathOf({ kind, slug }: PhotoPlace): string {
  return `/maps/${kind}/${slug}/`;
}

/** A page fitted to the photos. */
function pageOf(path: string, name: string, pagePhotos: MapPhoto[]): MapPage {
  const view = fitView(pagePhotos.map((photo) => [photo.longitude, photo.latitude]));
  return { path, name, photos: pagePhotos, view, whole: path === ALL_PHOTOS_PATH };
}

/** The photos with a position on the map, which every view shows. */
const mapPhotos = photos.filter(
  (photo): photo is MapPhoto => photo.latitude !== null && photo.longitude !== null,
);

/** Every place's page, by its address, with the photos in it. */
function placePages(): Map<string, MapPage> {
  const byPath = new Map<string, { name: string; photos: MapPhoto[] }>();
  for (const photo of mapPhotos) {
    for (const place of placesOf(photo)) {
      const entry = byPath.get(pathOf(place)) ?? { name: place.name, photos: [] };
      entry.photos.push(photo);
      byPath.set(pathOf(place), entry);
    }
  }
  return new Map(
    [...byPath].map(([path, entry]) => [path, pageOf(path, entry.name, entry.photos)]),
  );
}

/** Every map page by its address: each place's, and the whole map's. */
export const mapPages: Map<string, MapPage> = new Map([
  [ALL_PHOTOS_PATH, pageOf(ALL_PHOTOS_PATH, "Every photo", mapPhotos)],
  ...placePages(),
]);

/**
 * The page to share for the photos in view: the most specific place they're all in, such as their
 * city, or the whole map when they aren't all in one place or none are in view.
 */
export function mapPageFor(inView: Photo[]): MapPage {
  const [first] = inView;
  const shared = (first ? placesOf(first) : []).find((place) =>
    inView.every((photo) => placesOf(photo).some((other) => pathOf(other) === pathOf(place))),
  );
  return mapPages.get(shared ? pathOf(shared) : ALL_PHOTOS_PATH)!;
}
