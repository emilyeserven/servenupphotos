import { type RefObject, useEffect } from "react";

/** Whether the event happened in a dialog opened over the panel, such as the confirm dialog. */
function inDialog(event: Event): boolean {
  const target = event.target;
  return target instanceof Element && target.closest('[data-slot^="dialog-"]') !== null;
}

/**
 * Closes a panel on Escape, or a click outside every one of refs, while it's open. A click or
 * Escape in a dialog opened from the panel leaves it open, so the panel can say how it went.
 */
export function useDismiss(
  open: boolean,
  refs: RefObject<HTMLElement | null>[],
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (inDialog(event)) return;
      if (!refs.some((ref) => ref.current?.contains(event.target as Node))) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !inDialog(event)) close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refs, close]);
}
