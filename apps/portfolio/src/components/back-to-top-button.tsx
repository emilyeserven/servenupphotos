import { useLocation } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@portfolio/components/ui/button";
import { cn } from "@portfolio/lib/utils";

/** The pages without the button: the Map and the Color page fill the screen and don't scroll. */
const PAGES_WITHOUT: readonly string[] = ["/map", "/color"];

/** How far, in pixels, the page must be from the end a button goes to before the button shows. */
const SHOW_AFTER = 400;

/** Listens for the page scrolling. */
function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/** Which end of the page a scroll button goes to. */
type ScrollEnd = "top" | "bottom";

/** How far, in pixels, the page is scrolled from end. */
function distanceFrom(end: ScrollEnd): number {
  if (end === "top") return window.scrollY;
  return document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
}

/** Whether the page is far enough from end for its button to show. */
function useFarFrom(end: ScrollEnd): boolean {
  return useSyncExternalStore(
    subscribe,
    () => distanceFrom(end) > SHOW_AFTER,
    () => false,
  );
}

/** Each button's words and arrow. */
const ENDS = {
  top: { label: "Back to top", Icon: ArrowUpIcon },
  bottom: { label: "Jump to bottom", Icon: ArrowDownIcon },
} as const;

/**
 * A round button at the bottom left of every page except the Map and the Color page that scrolls
 * smoothly back to the top. It fades in once the visitor has scrolled down a little.
 */
export function BackToTopButton() {
  const path = useLocation({ select: (location) => location.pathname });
  return PAGES_WITHOUT.includes(path) ? null : <ScrollButton to="top" />;
}

/**
 * A round button that scrolls smoothly to the top or the bottom of the page, hidden while the page
 * is already near that end. The pipeline's Photo Pages uses both. `className` places it on the
 * screen; it's at the bottom left without one.
 */
export function ScrollButton(props: { to: ScrollEnd; className?: string }) {
  const { to, className = "bottom-4 left-4" } = props;
  const shown = useFarFrom(to);
  const { label, Icon } = ENDS[to];
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      onClick={() =>
        window.scrollTo({
          top: to === "top" ? 0 : document.documentElement.scrollHeight,
          behavior: "smooth",
        })
      }
      className={cn(
        "fixed z-40 rounded-full bg-muted shadow-sm transition-opacity duration-200 dark:bg-muted",
        shown ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
    >
      <Icon className="size-5" />
    </Button>
  );
}
