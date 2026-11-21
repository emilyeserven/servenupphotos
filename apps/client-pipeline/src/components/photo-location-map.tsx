import { Map, Marker, NavigationControl, useMap } from "@vis.gl/react-maplibre";
import { setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect } from "react";
import { PipelineCoordinatesMenu } from "@/components/map-coordinates";
import { Button } from "@/components/ui/button";
import { gpsText, writtenPosition } from "@/lib/place-gps";
import { MAP_STYLES, useIsDark } from "@portfolio/lib/map-theme";

setWorkerUrl(maplibreWorkerUrl);

/** A spot on the map, in degrees. */
interface Position {
  latitude: number;
  longitude: number;
}

/** How close the map starts on the photo's pin: a few streets around it. */
const PIN_ZOOM = 14;

/** Degrees to six decimal places, about 10 cm, which is as exact as a photo's position needs. */
function rounded(degrees: number): number {
  return Math.round(degrees * 1e6) / 1e6;
}

/** A spot the map reports, as the custom GPS position's text. */
function positionText({ lat, lng }: { lat: number; lng: number }): string {
  return gpsText({ latitude: rounded(lat), longitude: rounded(lng) });
}

interface PhotoLocationMapProps {
  /** The custom GPS position as typed, "latitude, longitude"; empty when there's none. */
  value: string;
  /** The GPS position in the photo's EXIF, or null when it has none. */
  exifGps: string | null;
  disabled: boolean;
  /** Sets the custom GPS position, or clears it with "" to go back to the EXIF one. */
  onChange: (value: string) => void;
}

/** Where the map starts: around the pin, or the whole world when there's none. */
function startView(pin: Position | null) {
  return pin ? { ...pin, zoom: PIN_ZOOM } : { latitude: 20, longitude: 0, zoom: 1 };
}

/**
 * The photo's pin on a map: at its custom GPS position, or else the one in its EXIF. Dragging the pin,
 * or clicking the map, sets the custom position there; the EXIF one stays as it is, shown as a small
 * grey dot once the pin has moved off it.
 */
export function PhotoLocationMap({ value, exifGps, disabled, onChange }: PhotoLocationMapProps) {
  const custom = writtenPosition(value);
  const exif = writtenPosition(exifGps ?? undefined);
  const move = (spot: { lat: number; lng: number }) => {
    if (!disabled) onChange(positionText(spot));
  };
  return (
    <div className="flex flex-col gap-2">
      <PinMap custom={custom} exif={exif} disabled={disabled} onMove={move} />
      <PinStatus
        custom={custom !== null}
        exif={exif !== null}
        disabled={disabled}
        onReset={() => onChange("")}
      />
    </div>
  );
}

interface PinMapProps {
  /** The custom GPS position, or null when there's none. */
  custom: Position | null;
  /** The GPS position in the photo's EXIF, or null when it has none. */
  exif: Position | null;
  disabled: boolean;
  /** Sets the custom position where the pin was dropped or the map was clicked. */
  onMove: (spot: { lat: number; lng: number }) => void;
}

/** The map, in the page's theme, with the pin and the EXIF dot. */
function PinMap({ custom, exif, disabled, onMove }: PinMapProps) {
  const dark = useIsDark();
  return (
    <div className="h-72 overflow-hidden rounded-md border md:h-96">
      <Map
        initialViewState={startView(custom ?? exif)}
        mapStyle={MAP_STYLES[dark ? "dark" : "light"]}
        cursor={disabled ? undefined : "crosshair"}
        onClick={(event) => onMove(event.lngLat)}
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <ExifDot custom={custom} exif={exif} />
        <DraggablePin custom={custom} exif={exif} disabled={disabled} onMove={onMove} />
        <PipelineCoordinatesMenu />
      </Map>
    </div>
  );
}

/** The EXIF's GPS position as a small grey dot, once the pin has moved off it to a custom one. */
function ExifDot({ custom, exif }: Pick<PinMapProps, "custom" | "exif">) {
  if (!custom || !exif) return null;
  return (
    <Marker {...exif}>
      <span
        title="The GPS position in the photo's EXIF"
        className="block size-3 rounded-full border-2 border-white bg-neutral-500 shadow"
      />
    </Marker>
  );
}

/** The pin's color at a custom position (red) and at the EXIF one (grey). */
const PIN_LOOKS = {
  custom: { key: "custom", color: "#dc2626" },
  exif: { key: "exif", color: "#525252" },
};

/**
 * The photo's pin at its custom position in red, or else at the EXIF one in grey, which can be
 * dragged to a new spot and keeps itself in view; nothing when there's neither.
 */
function DraggablePin({ custom, exif, disabled, onMove }: PinMapProps) {
  const pin = custom ?? exif;
  if (!pin) return null;
  const look = custom ? PIN_LOOKS.custom : PIN_LOOKS.exif;
  return (
    <>
      <Marker
        // MapLibre sets a marker's color only when it's made, so a new one replaces it.
        key={look.key}
        {...pin}
        // The default pin already sets its own offset so its tip is on the spot; an anchor would move it.
        color={look.color}
        draggable={!disabled}
        onDragEnd={(event) => onMove(event.lngLat)}
      />
      <FollowPin pin={pin} />
    </>
  );
}

/**
 * Brings the pin back into view when it moves off the map, such as when a position is typed or
 * pasted into the field below; a drag or a click keeps it in view already.
 */
function FollowPin({ pin }: { pin: Position }) {
  const { current: map } = useMap();
  const { latitude, longitude } = pin;
  useEffect(() => {
    if (!map) return;
    const center: [number, number] = [longitude, latitude];
    if (!map.getBounds().contains(center))
      map.easeTo({ center, zoom: Math.max(map.getZoom(), PIN_ZOOM) });
  }, [map, latitude, longitude]);
  return null;
}

/** What the pin shows and how to move it. */
function pinStatus(custom: boolean, exif: boolean): string {
  if (custom) return "The red pin is the custom position. Drag it, or click the map, to move it.";
  if (exif)
    return "The grey pin is the GPS position from the photo's EXIF. Drag it, or click the map, to set a custom one; the EXIF is kept as it is.";
  return "No GPS position yet. Click the map to drop a pin where the photo was taken.";
}

interface PinStatusProps {
  /** Whether the pin is at a custom position. */
  custom: boolean;
  /** Whether the photo's EXIF has a GPS position. */
  exif: boolean;
  disabled: boolean;
  /** Clears the custom position. */
  onReset: () => void;
}

/** What the pin shows, and a button to go back to the EXIF position (or take the pin off) once it's moved. */
function PinStatus({ custom, exif, disabled, onReset }: PinStatusProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-muted-foreground text-sm">{pinStatus(custom, exif)}</p>
      {custom && (
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onReset}>
          {exif ? "Back to the EXIF position" : "Remove the pin"}
        </Button>
      )}
    </div>
  );
}
