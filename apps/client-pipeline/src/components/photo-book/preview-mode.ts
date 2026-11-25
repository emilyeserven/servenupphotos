import { useEffect, useState } from "react";
import { useSidebarStore } from "@/stores/sidebar";

/**
 * Preview Mode, on or off. Turning it on collapses the app's sidebar; turning it off, or leaving
 * the page, opens the sidebar again if it was open before.
 */
export function usePreviewMode() {
  const [sidebarWas, setSidebarWas] = useState<boolean | null>(null);
  const setSidebar = useSidebarStore((state) => state.setOpen);
  const turn = (on: boolean) => {
    if (on) {
      setSidebarWas(useSidebarStore.getState().open);
      setSidebar(false);
      return;
    }
    setSidebar(sidebarWas ?? true);
    setSidebarWas(null);
  };
  useEffect(() => {
    if (sidebarWas === null) return undefined;
    return () => setSidebar(sidebarWas);
  }, [sidebarWas, setSidebar]);
  return { on: sidebarWas !== null, turn };
}

/** While on, Esc calls onExit and the left and right arrow keys call onPage with -1 or 1. */
export function usePreviewKeys(on: boolean, onExit: () => void, onPage: (by: -1 | 1) => void) {
  useEffect(() => {
    if (!on) return undefined;
    const keys: Record<string, () => void> = {
      Escape: onExit,
      ArrowLeft: () => onPage(-1),
      ArrowRight: () => onPage(1),
    };
    const onKeyDown = (event: KeyboardEvent) => keys[event.key]?.();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [on, onExit, onPage]);
}
