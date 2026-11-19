import { Layer, Source } from "@vis.gl/react-maplibre";
import { SOURCE_ID } from "@/lib/map-country-groups";
import type { MapPhotos } from "@/lib/map-photos";

/**
 * One of the map's photo sources, which MapLibre groups into clusters. The markers are HTML, drawn
 * from those clusters (see markersInView). MapLibre only clusters a source a layer uses, so its
 * layer draws nothing.
 */
function PhotoSource({
  id,
  data,
  radius,
}: {
  id: string;
  data: MapPhotos["geoJson"];
  radius: number;
}) {
  return (
    <Source
      // Grouping differently needs a new source, as MapLibre can't change it on one.
      key={radius}
      id={id}
      type="geojson"
      data={data}
      cluster
      clusterMaxZoom={17}
      // Photos group when they're closer than this many pixels: by default a little under a
      // marker's width, so groups split as soon as their markers would barely overlap.
      clusterRadius={radius}
    >
      <Layer
        id={`${id}-points`}
        type="circle"
        source={id}
        paint={{ "circle-opacity": 0, "circle-stroke-opacity": 0 }}
      />
    </Source>
  );
}

/**
 * The map's photo sources, grouping photos closer than `radius` pixels: one of every photo, which
 * the markers come from when zoomed in, and one for each country's photos, which they come from
 * when zoomed out (see groupingSources), so no group there mixes two countries.
 */
export function MapPhotoSources({ mapPhotos, radius }: { mapPhotos: MapPhotos; radius: number }) {
  return (
    <>
      <PhotoSource id={SOURCE_ID} data={mapPhotos.geoJson} radius={radius} />
      {mapPhotos.countries.map((country) => (
        <PhotoSource key={country.id} id={country.id} data={country.geoJson} radius={radius} />
      ))}
    </>
  );
}
