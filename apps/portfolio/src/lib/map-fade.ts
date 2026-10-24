import type { MapRef } from "@vis.gl/react-maplibre";

/** How long the map takes to fade out, and back in, in milliseconds. */
const FADE_MS = 200;

/** The longest the map waits for the new spot to draw before fading back in, in milliseconds. */
const MAX_DRAW_WAIT_MS = 600;

/** Fades the map's picture and markers in or out; its controls stay as they are. */
function setShown(map: MapRef, shown: boolean) {
  const layer = map.getCanvasContainer();
  layer.style.transition = `opacity ${FADE_MS}ms ease`;
  layer.style.opacity = shown ? "1" : "0";
}

/** Fades the map back in once it has drawn where it moved to, or after MAX_DRAW_WAIT_MS. */
function showOnceDrawn(map: MapRef) {
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    setShown(map, true);
  };
  map.once("idle", show);
  setTimeout(show, MAX_DRAW_WAIT_MS);
}

/**
 * Moves the map somewhere else by fading out, jumping there and fading back in, rather than flying
 * out and back in over everything between. `jump` moves the map without animating.
 */
export function fadeTo(map: MapRef, jump: (map: MapRef) => void) {
  setShown(map, false);
  setTimeout(() => {
    jump(map);
    showOnceDrawn(map);
  }, FADE_MS);
}
