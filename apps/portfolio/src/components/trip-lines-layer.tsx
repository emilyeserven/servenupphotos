import { Layer, Source } from "@vis.gl/react-maplibre";
import { TripFlowLayer } from "@/components/trip-flow-layer";
import type { PlacedPhoto } from "@/lib/map-photos";
import { useIsDark } from "@/lib/map-theme";
import { tripLineLayers } from "@/lib/trip-line-layers";
import { type TripLinesMap, useShownTripLines } from "@/lib/trip-lines-map";

/**
 * The trip lines of the days the map's photos were taken, from TRIPLINES.geo.json: walks in blue,
 * drives in solid light blue, lines that run over an earlier one drawn to its side, a Trip's ferries in teal dots and flights as pink dashed arcs, hops along a transit line in its color and others dashed, and areas
 * shaded light blue, with a light running along each line the way it was travelled when `flow` is on. Nothing while
 * `show` is off or there are none, and none of the `hidden` Trips.
 */
export function TripLinesLayer({
  photos,
  show,
  flow,
  hidden,
}: {
  photos: PlacedPhoto[];
  show: boolean;
  /** Whether a light runs along each line the way it was travelled. */
  flow: boolean;
  /** The Trips whose lines are left out, turned off in the Places menu's Trip tab. */
  hidden: string[];
}) {
  const data = useShownTripLines(photos, show, hidden);
  const dark = useIsDark();
  return data ? <TripLinesSource data={data} dark={dark} flow={flow} /> : null;
}

interface TripLinesSourceProps {
  data: TripLinesMap;
  dark: boolean;
  flow: boolean;
}

function TripLinesSource({ data, dark, flow }: TripLinesSourceProps) {
  return (
    <Source id="trip-lines" type="geojson" data={data} lineMetrics>
      {tripLineLayers(dark).map((layer) => (
        <Layer key={layer.id} {...layer} />
      ))}
      {flow && <TripFlowLayer />}
    </Source>
  );
}
