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
import type { TripFence, TripPoint, TripSegment, TripVisit } from "@/api/trip-lines";
import { FenceAreas } from "@/components/trip-lines/fence-areas";
import { lineFeatures, pointsBounds } from "@/components/trip-lines/route-geometry";
import { VISIT_ICONS } from "@/components/trip-lines/visit-icons";
import type { TripPhoto } from "@/lib/trip-days";
import { fenceCorners } from "@/lib/trip-fences";
import { cn } from "@/lib/utils";

setWorkerUrl(maplibreWorkerUrl);

// The same free CARTO basemap as the portfolio's map.
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

/** The line's opacity: full, or faint when outside the group shown on its own. */
function opacity(full: number): ["case", ["get", string], number, number] {
  return ["case", ["get", "faded"], 0.15, full];
}

/** Walking, a solid line, fainter for a preview. */
function walkLayer(preview: boolean): LayerProps {
  return {
    id: "trip-walk",
    type: "line",
    filter: ["==", ["get", "mode"], "walk"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#2563eb",
      "line-width": 4,
      "line-opacity": opacity(preview ? 0.5 : 0.9),
    },
  };
}

/** A hop by train, subway, bus or car with no line picked, a dashed line. */
const hopLayer: LayerProps = {
  id: "trip-hop",
  type: "line",
  filter: ["all", ["!=", ["get", "mode"], "walk"], ["!", ["get", "onLine"]]],
  paint: {
    "line-color": ["get", "colour"],
    "line-width": 3,
    "line-dasharray": [2, 2],
    "line-opacity": opacity(1),
  },
};

/** A hop along the track of the line it rode, solid in that line's color. */
const lineLayer: LayerProps = {
  id: "trip-transit-line",
  type: "line",
  filter: ["get", "onLine"],
  layout: { "line-cap": "round", "line-join": "round" },
  paint: { "line-color": ["get", "colour"], "line-width": 4, "line-opacity": opacity(0.9) },
};

interface RouteMapProps {
  day: string;
  photos: TripPhoto[];
  segments: TripSegment[];
  /** A preview not yet saved, drawn fainter. */
  preview?: boolean;
  /** The photo pointed at in the strip. */
  highlighted?: number;
  /** The name of the group shown on its own, the others faded. */
  focus?: string;
  /** The day's spots with no photo. */
  ends: TripPoint[];
  /** Picks a spot on the map, while the editor is waiting for one. */
  onPick?: (point: TripPoint) => void;
  /** The via points that shape the line, each with where it is in the draft. */
  vias?: { key: string; index: number; point: TripPoint }[];
  /** Moves a via point, or removes it with null; left out, they can't be changed. */
  onMoveVia?: (key: string, index: number, point: TripPoint | null) => void;
  /** The places visited along the route, as pins. */
  visits?: TripVisit[];
  /** The areas photos without an exact spot were taken in, shaded. */
  fences?: TripFence[];
}

/** The day's photos as numbered dots, and its trip line drawn through them. */
export function RouteMap({
  day,
  photos,
  segments,
  preview,
  highlighted,
  focus,
  ends,
  onPick,
  vias = [],
  onMoveVia,
  visits = [],
  fences = [],
}: RouteMapProps) {
  const bounds = pointsBounds([...photos, ...ends, ...visits, ...fenceCorners(fences)]);
  return (
    <div
      className={cn("h-80 overflow-hidden rounded-md border md:h-96", onPick && "cursor-crosshair")}
    >
      <Map
        key={day}
        initialViewState={{ bounds, fitBoundsOptions: { padding: 40, maxZoom: 16 } }}
        mapStyle={MAP_STYLE}
        cursor={onPick ? "crosshair" : undefined}
        onClick={(e) => onPick?.({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <FenceAreas fences={fences} />
        <Source id="trip-line" type="geojson" data={lineFeatures(segments, photos, focus)}>
          <Layer {...walkLayer(preview === true)} />
          <Layer {...hopLayer} />
          <Layer {...lineLayer} />
        </Source>
        {photos.map((p, i) => (
          <Marker key={p.id} latitude={p.latitude} longitude={p.longitude}>
            <PhotoDot n={i + 1} highlighted={p.id === highlighted} />
          </Marker>
        ))}
        {vias.map(({ key, index, point }) => (
          <Marker
            key={`via-${key}-${index}`}
            latitude={point.latitude}
            longitude={point.longitude}
            draggable={onMoveVia !== undefined}
            onDragEnd={(e) =>
              onMoveVia?.(key, index, { latitude: e.lngLat.lat, longitude: e.lngLat.lng })
            }
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onMoveVia?.(key, index, null);
            }}
          >
            <span
              title="Via point: drag to move, click to remove"
              className="block size-3 rotate-45 cursor-grab border-2 border-blue-600 bg-white shadow"
            />
          </Marker>
        ))}
        {visits.map((v, i) => (
          <Marker key={`visit-${i}`} latitude={v.latitude} longitude={v.longitude}>
            <VisitPin visit={v} />
          </Marker>
        ))}
        {ends.map((p, i) => (
          <Marker key={`end-${i}`} latitude={p.latitude} longitude={p.longitude}>
            <span className="bg-foreground text-background rounded px-1.5 py-0.5 text-xs shadow">
              {p.label || "Spot"}
            </span>
          </Marker>
        ))}
      </Map>
    </div>
  );
}

/** A place visited, as a round pin with its kind's icon and its name on hover. */
function VisitPin({ visit }: { visit: TripVisit }) {
  const Icon = VISIT_ICONS[visit.kind];
  return (
    <span
      title={visit.name || "A place visited"}
      className="flex size-6 items-center justify-center rounded-full border-2 border-amber-500 bg-white text-amber-600 shadow"
    >
      <Icon className="size-3.5" aria-hidden />
    </span>
  );
}

function PhotoDot({ n, highlighted }: { n: number; highlighted: boolean }) {
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-[11px] font-semibold text-white shadow",
        highlighted && "scale-125 bg-orange-500",
      )}
    >
      {n}
    </span>
  );
}
