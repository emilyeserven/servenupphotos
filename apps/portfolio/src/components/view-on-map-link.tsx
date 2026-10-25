import { Link, useMatchRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { parseFilters } from "@/lib/photo-filters";
import type { Photo } from "@/lib/photos";

/** How close the map zooms to a photo at its own GPS position: a few streets around it. */
const EXACT_ZOOM = 17;
/** How close it zooms to a photo placed at one of its places, which is only near where it was taken. */
const APPROXIMATE_ZOOM = 15;

/** Where the map should look to show the photo, or null for a photo it can't place. */
export function mapViewOf({ latitude, longitude, approximatePosition }: Photo) {
  if (latitude === null || longitude === null) return null;
  return {
    lat: Number(latitude.toFixed(5)),
    lng: Number(longitude.toFixed(5)),
    zoom: approximatePosition ? APPROXIMATE_ZOOM : EXACT_ZOOM,
  };
}

/** Where the map looks to show a photo: its center and zoom, as the Map's URL keeps them. */
type MapView = NonNullable<ReturnType<typeof mapViewOf>>;

/**
 * A **View on map** link for the photo viewer's place tooltip, opening the Map zoomed in on where
 * the photo was taken, as `/map?lat=…&lng=…&zoom=…`. On the Map it keeps the filters; from other
 * views it opens the Map with none, as the Map doesn't keep filters set before.
 * Null for a photo the map can't place, so the tooltip isn't shown just for it.
 */
export function viewOnMapLink(photo: Photo): ReactNode {
  const view = mapViewOf(photo);
  return view ? <ViewOnMapLink view={view} /> : null;
}

function ViewOnMapLink({ view }: { view: MapView }) {
  const onMap = Boolean(useMatchRoute()({ to: "/map" }));
  return (
    <Link
      to="/map"
      search={(prev: Record<string, unknown>) => ({
        ...(onMap ? parseFilters(prev) : {}),
        ...view,
      })}
      className="mt-1 inline-flex items-center gap-1 self-start rounded-sm font-medium underline underline-offset-4 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <MapPin className="size-3.5" aria-hidden />
      View on map
    </Link>
  );
}
