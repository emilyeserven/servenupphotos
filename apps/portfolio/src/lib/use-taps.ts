import { useEffect, useRef } from "react";

/** The longest gap, in milliseconds, between two taps or clicks that make a double tap. */
const DOUBLE_TAP_MS = 300;

/**
 * Tells a single tap (or click) from a double tap. onDouble runs on the second tap. onSingle runs
 * only once no second tap has come within DOUBLE_TAP_MS, so a double tap never runs it; left out,
 * there's no wait. Returns the click handler to put on the element.
 */
export function useTaps({
  onSingle,
  onDouble,
}: {
  onSingle?: () => void;
  onDouble: () => void;
}): () => void {
  const lastTap = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(pending.current), []);
  return () => {
    const now = performance.now();
    clearTimeout(pending.current);
    if (now - lastTap.current <= DOUBLE_TAP_MS) {
      // A third quick tap starts over instead of making another double tap.
      lastTap.current = 0;
      onDouble();
      return;
    }
    lastTap.current = now;
    if (onSingle) pending.current = setTimeout(onSingle, DOUBLE_TAP_MS);
  };
}
