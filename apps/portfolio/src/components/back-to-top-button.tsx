import { useLocation } from "@tanstack/react-router";
import { ArrowUpIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@portfolio/components/ui/button";
import { cn } from "@portfolio/lib/utils";

/** The pages without the button: the Map and the Color page fill the screen and don't scroll. */
const PAGES_WITHOUT: readonly string[] = ["/map", "/color"];

/** How far down the page, in pixels, the visitor scrolls before the button shows. */
const SHOW_AFTER = 400;

/** Listens for the page scrolling. */
function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/** Whether the page is scrolled far enough down for the button to show. */
function useScrolledDown(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.scrollY > SHOW_AFTER,
    () => false,
  );
}

/**
 * A round button at the bottom left of every page except the Map and the Color page that scrolls
 * smoothly back to the top. It fades in once the visitor has scrolled down a little.
 */
export function BackToTopButton() {
  const path = useLocation({ select: (location) => location.pathname });
  return PAGES_WITHOUT.includes(path) ? null : <ScrollUpButton />;
}

/**
 * The round button that scrolls smoothly back to the top, hidden until the page is scrolled down.
 * The pipeline's Photo Pages uses it too. `className` places it on the screen; it's at the bottom
 * left without one.
 */
export function ScrollUpButton({ className = "bottom-4 left-4" }: { className?: string }) {
  const shown = useScrolledDown();
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Back to top"
      title="Back to top"
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed z-40 rounded-full bg-muted shadow-sm transition-opacity duration-200 dark:bg-muted",
        shown ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
    >
      <ArrowUpIcon className="size-5" />
    </Button>
  );
}
