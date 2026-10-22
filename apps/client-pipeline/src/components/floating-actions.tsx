import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";

/** Where page actions float, to the right of the sync button at the top right of every page. */
const useSlot = create<{ el: HTMLElement | null; set: (el: HTMLElement | null) => void }>()(
  (set) => ({ el: null, set: (el) => set({ el }) }),
);

/** The place, next to the sync button, that FloatingAction puts its children. */
export function FloatingActionsSlot() {
  const set = useSlot((s) => s.set);
  return <div ref={set} className="flex items-center gap-2 empty:hidden" />;
}

/**
 * children floated to the right of the sync button at the top right, such as Edit Photo's Save
 * changes, so they're in reach anywhere on the page; where they are when there's no sync button.
 */
export function FloatingAction({ children }: { children: ReactNode }) {
  const el = useSlot((s) => s.el);
  return el ? createPortal(children, el) : children;
}
