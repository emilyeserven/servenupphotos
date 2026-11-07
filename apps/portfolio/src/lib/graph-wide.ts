import { useState } from "react";

/** Where the Graph page keeps whether it's wide, in the visitor's browser. */
const STORAGE_KEY = "servenup:graph-wide";

/** Whether the visitor last made the Graph page wide; not when it can't be read. */
function readWide(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Whether the Graph page uses the window's whole width rather than the usual column, and setting
 * it, remembered in the visitor's browser for their next visit.
 */
export function useGraphWide(): [boolean, (wide: boolean) => void] {
  const [wide, setWide] = useState(readWide);
  const change = (next: boolean) => {
    setWide(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Blocked storage: it stays wide for this visit only.
    }
  };
  return [wide, change];
}
