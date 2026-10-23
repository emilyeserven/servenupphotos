import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { parseFilters } from "@/lib/photo-filters";
import type { Photo } from "@/lib/photos";

/** How close the map zooms to a photo at its own GPS position: a few streets around it. */
const EXACT_ZOOM = 17;
/** How close it zooms to a photo placed at one of its places, which is only near where it was taken. */
const APPROXIMATE_ZOOM = 15;

/** Where the map should look to show the photo, or null for a photo it can't place. */
function mapViewOf({ latitude, longitude, approximatePosition }: Photo) {
  if (latitude === null || longitude === null) return null;
  return {
    lat: Number(latitude.toFixed(5)),
    lng: Number(longitude.toFixed(5)),
    zoom: approximatePosition ? APPROXIMATE_ZOOM : EXACT_ZOOM,
  };
}

/**
 * A **View on map** link in the photo viewer, opening the Map zoomed in on where the photo was
 * taken, as `/map?lat=…&lng=…&zoom=…`, keeping the location, album and tag filters. Left out for a
 * photo the map can't place.
 */
export function ViewOnMapLink({ photo }: { photo: Photo }) {
  const view = mapViewOf(photo);
  if (!view) return null;
  return (
    <Link
      to="/map"
      search={(prev: Record<string, unknown>) => ({ ...parseFilters(prev), ...view })}
      className="inline-flex shrink-0 items-center gap-1 rounded-sm text-white/80 underline-offset-4 outline-none hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <MapPin className="size-3.5" aria-hidden />
      View on map
    </Link>
  );
}
