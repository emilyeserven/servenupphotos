import { useSyncExternalStore } from "react";

/** Listens for the window resizing. */
function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** The window's width in pixels, kept up to date as it resizes, like the width Tailwind's breakpoints read. */
export function useWindowWidth(): number {
  return useSyncExternalStore(subscribe, () => window.innerWidth);
}
