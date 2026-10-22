import { type RefObject, useEffect } from "react";

/** Closes a panel on Escape, or a click outside every one of refs, while it's open. */
export function useDismiss(
  open: boolean,
  refs: RefObject<HTMLElement | null>[],
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!refs.some((ref) => ref.current?.contains(event.target as Node))) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refs, close]);
}
