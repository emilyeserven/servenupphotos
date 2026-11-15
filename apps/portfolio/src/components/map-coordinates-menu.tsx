import { Button } from "@portfolio/components/ui/button";
import { MAP_POPUP } from "@portfolio/components/map-popup";
import { formatCoordinates, type MapSpot } from "@portfolio/lib/map-coordinates";
import { Popup, useMap } from "@vis.gl/react-maplibre";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { MapMouseEvent } from "maplibre-gl";
import { useCallback, useEffect, useState } from "react";

/**
 * Copies the coordinates' text and says whether it could. Each app copies its own way: the
 * portfolio with the Clipboard API, the pipeline with its copy modal as the fallback.
 */
export type CopyCoordinates = (text: string) => Promise<boolean>;

/** Copies with the Clipboard API, which works on the portfolio as it's served over HTTPS. */
const copyWithClipboard: CopyCoordinates = (text) =>
  navigator.clipboard?.writeText(text).then(
    () => true,
    () => false,
  ) ?? Promise.resolve(false);

/** How long the menu shows "Copied" before it closes, in milliseconds. */
const COPIED_MS = 1200;

/**
 * Right-clicking a map (or a long press on Android) opens a small menu at that spot with its
 * latitude and longitude and a **Copy coordinates** button (`docs/portfolio-map.md#copy-coordinates`).
 * It goes inside the `<Map>`, and listens to the map itself, so the map needs nothing else.
 * Clicking the map closes it.
 */
export function CoordinatesMenu({
  copy = copyWithClipboard,
}: {
  /** How to copy the coordinates; the Clipboard API when left out. */
  copy?: CopyCoordinates;
}) {
  const { current: map } = useMap();
  const [spot, setSpot] = useState<MapSpot | null>(null);
  // Kept the same between renders, so the popup's timer to close isn't restarted.
  const close = useCallback(() => setSpot(null), []);
  useEffect(() => {
    if (!map) return;
    const open = (event: MapMouseEvent) => {
      // Instead of the browser's own menu.
      event.originalEvent.preventDefault();
      setSpot({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    };
    map.on("contextmenu", open);
    return () => {
      map.off("contextmenu", open);
    };
  }, [map]);
  if (!spot) return null;
  return (
    <CoordinatesPopup
      // A new spot starts fresh, without the last one's "Copied".
      key={`${spot.lat},${spot.lng}`}
      spot={spot}
      copy={copy}
      onClose={close}
    />
  );
}

/** Whether the last copy worked, didn't, or hasn't been tried yet. */
type CopyState = "idle" | "copied" | "failed";

/** The menu: a popup above the spot with its coordinates, selectable, and the copy button. */
function CoordinatesPopup({
  spot,
  copy,
  onClose,
}: {
  spot: MapSpot;
  copy: CopyCoordinates;
  onClose: () => void;
}) {
  const text = formatCoordinates(spot);
  const [state, setState] = useState<CopyState>("idle");
  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(onClose, COPIED_MS);
    return () => clearTimeout(timer);
  }, [state, onClose]);
  return (
    <Popup
      longitude={spot.lng}
      latitude={spot.lat}
      anchor="bottom"
      offset={6}
      closeButton={false}
      onClose={onClose}
      className={MAP_POPUP}
    >
      <div className="flex flex-col items-start gap-1.5">
        <code className="font-mono text-xs select-all">{text}</code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copy(text).then((ok) => setState(ok ? "copied" : "failed"))}
        >
          {state === "copied" ? <CheckIcon /> : <CopyIcon />}
          {state === "copied" ? "Copied" : "Copy coordinates"}
        </Button>
        {state === "failed" && (
          <p className="max-w-48 text-xs text-neutral-600 dark:text-neutral-400">
            This browser won't copy from here. Select the numbers above and copy them.
          </p>
        )}
      </div>
    </Popup>
  );
}
