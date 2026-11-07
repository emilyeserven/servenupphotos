import { useState } from "react";

/** Where the browser remembers whether the Gear & settings graphics pane is shown. */
const STORAGE_KEY = "gear-settings-graphics";

/** Whether the pane was shown last time; hidden when the browser doesn't say. */
function storedOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

/** Remembers whether the pane is shown, when the browser lets it. */
function store(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // A browser that won't store it just forgets it.
  }
}

/**
 * Whether the Gear & settings picker shows its graphics pane beside the sliders, and a setter
 * that the browser remembers, so it stays as it was left on the next visit.
 */
export function useGraphicsPane(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(storedOn);
  return [
    on,
    (next) => {
      setOn(next);
      store(next);
    },
  ];
}
