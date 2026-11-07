import { MAP_STYLES, useIsDark } from "@portfolio/lib/map-theme";
import { withLanes } from "@portfolio/lib/trip-lanes";
import { tripLineLayers } from "@portfolio/lib/trip-line-layers";
import {
  Layer,
  Map,
  Marker,
  NavigationControl,
  Source,
  type LayerProps,
} from "@vis.gl/react-maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { Trip } from "@/api/trips";
import { dayTitle } from "@/components/trip-lines/day-title";
import { type TripMapDays, tripMapData, tripMapPoints } from "@/lib/trip-map";

setWorkerUrl(maplibreWorkerUrl);

/** The days' photos, as small dots under the lines' ends. */
function photoLayer(dark: boolean): LayerProps {
  return {
    id: "trip-photos",
    type: "circle",
    filter: ["==", ["get", "feature"], "photo"],
    paint: {
      "circle-radius": 3,
      "circle-color": dark ? "#e5e5e5" : "#404040",
      "circle-stroke-color": dark ? "#171717" : "#ffffff",
      "circle-stroke-width": 1,
    },
  };
}

/** The bounds of the points, as [west, south, east, north]. */
function boundsOf(points: [number, number][]): [number, number, number, number] {
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

/**
 * The Trip on a map, at the top of its page: each day's line in the portfolio map's colors, its
 * photos as dots with the day's number at its first, and its legs between days, such as a ferry in
 * teal dots or a flight in pink dashes. It follows the draft, so a leg shows as it's added.
 */
export function TripMap({ trip, ...days }: TripMapDays & { trip: Trip }) {
  const dark = useIsDark();
  const data = tripMapData(trip, days);
  const points = tripMapPoints(data);
  if (points.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border p-4 text-sm">
        The map shows the Trip's days once they have photos at an exact spot.
      </p>
    );
  }
  return (
    <div className="h-72 overflow-hidden rounded-md border md:h-96">
      <Map
        key={`${trip.start}-${trip.end}`}
        initialViewState={{
          bounds: boundsOf(points),
          fitBoundsOptions: { padding: 40, maxZoom: 14 },
        }}
        mapStyle={dark ? MAP_STYLES.dark : MAP_STYLES.light}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <Source id="trip" type="geojson" data={{ ...data, features: withLanes(data.features) }}>
          {tripLineLayers(dark).map((layer) => (
            <Layer key={layer.id} {...layer} />
          ))}
          <Layer {...photoLayer(dark)} />
        </Source>
        {days.days.map((d, i) => (
          <Marker key={d.day} latitude={d.photos[0]!.latitude} longitude={d.photos[0]!.longitude}>
            <span
              title={dayTitle(d.day)}
              className="bg-foreground text-background rounded-full px-1.5 text-xs font-medium shadow"
            >
              {i + 1}
            </span>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
