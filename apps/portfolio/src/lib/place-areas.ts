import { useEffect, useState } from "react";
import { placeById } from "@/lib/localize";
import { circleShape } from "@/lib/place-circle";

/** A GeoJSON MultiPolygon's coordinates: polygons of rings of [longitude, latitude]. */
type Shape = [number, number][][][];

/**
 * A place's area file, places/<id>.geo.json, which the pipeline saves: a GeoJSON Feature with the
 * outline of the area the place covers, such as a park.
 */
export interface PlaceAreaFeature {
  type: "Feature";
  properties: { place: string; osm?: string };
  geometry: { type: "MultiPolygon"; coordinates: Shape };
}

// Each area is its own file, loaded only when the map shows it, so outlines don't weigh on the
// pages that never draw them.
const files = import.meta.glob<PlaceAreaFeature>("../data/places/*.geo.json", {
  import: "default",
});

/** The loader of place id's area file, when it has one. */
function fileOf(id: string): (() => Promise<PlaceAreaFeature>) | undefined {
  return files[`../data/places/${id}.geo.json`];
}

/** The ID of the place a location value such as "place:osaka-castle-park" picks, or none. */
function placeIdOf(value: string | undefined): string | undefined {
  return value?.startsWith("place:") ? value.slice("place:".length) : undefined;
}

/**
 * Place id's area: its area file once loaded, or else, for a place with no area file, a circle
 * around its position (circleShape). Undefined while the file loads, or when there's no id or the
 * place has neither.
 */
export function usePlaceArea(id: string | undefined): PlaceAreaFeature | undefined {
  const file = useAreaFile(id);
  return file ?? (hasFile(id) ? undefined : pointArea(id));
}

/** Whether place id has an area file. */
function hasFile(id: string | undefined): boolean {
  return id !== undefined && fileOf(id) !== undefined;
}

/** A circle around place id's position as its area, or undefined when it has no position. */
function pointArea(id: string | undefined): PlaceAreaFeature | undefined {
  const place = placeById(id);
  if (place?.latitude === undefined || place.longitude === undefined) return undefined;
  return {
    type: "Feature",
    properties: { place: place.id },
    geometry: { type: "MultiPolygon", coordinates: circleShape(place.longitude, place.latitude) },
  };
}

/** Place id's area file, once loaded; undefined while it loads, or when there's no id or file. */
function useAreaFile(id: string | undefined): PlaceAreaFeature | undefined {
  const [loaded, setLoaded] = useState<{ id: string; feature: PlaceAreaFeature }>();
  useEffect(() => {
    const load = id === undefined ? undefined : fileOf(id);
    if (!load || id === undefined) return;
    let current = true;
    void load().then((feature) => {
      if (current) setLoaded({ id, feature });
    });
    return () => {
      current = false;
    };
  }, [id]);
  return loaded && loaded.id === id ? loaded.feature : undefined;
}

/** The place whose area the map shades, and whether it's only pointed at in the Places menu. */
export interface ShownArea {
  id?: string;
  hovered: boolean;
}

/**
 * Which place's area the map shades: the one pointed at in the Places menu, or else the one last
 * picked there. `hover` and `pick` take the menu's location values.
 */
export function useShownArea() {
  const [picked, setPicked] = useState<string>();
  const [hovered, setHovered] = useState<string>();
  const shown: ShownArea = { id: hovered ?? picked, hovered: hovered !== undefined };
  return {
    shown,
    hover: (value: string | undefined) => setHovered(placeIdOf(value)),
    pick: (value: string) => setPicked(placeIdOf(value)),
  };
}
