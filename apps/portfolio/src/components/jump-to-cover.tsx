import { ArrowDownToLine } from "lucide-react";
import type { Photo } from "@/lib/photos";
import { useShownPhoto } from "@/lib/shown-photo";

/** The attribute each photo's tile or row on the Grid and Timeline carries, with its ID, as `data-photo-id={photo.id}`. */
const PHOTO_ID_ATTRIBUTE = "data-photo-id";

/** Whether the viewer asked for reduced motion. */
function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The photo's tile or row on the page, or null when it isn't there, such as when filtered out. */
function photoElement(photo: Photo): Element | null {
  return document.querySelector(`[${PHOTO_ID_ATTRIBUTE}="${photo.id}"]`);
}

/** Scrolls the element to the middle of the screen and rings it for a moment, so it's easy to spot. */
function spotlight(element: Element) {
  const motion = reducedMotion();
  element.scrollIntoView({ block: "center", behavior: motion ? "auto" : "smooth" });
  element.animate(
    [
      { boxShadow: "0 0 0 4px var(--ring)", borderRadius: "0.5rem" },
      { boxShadow: "0 0 0 4px transparent", borderRadius: "0.5rem" },
    ],
    { duration: motion ? 0 : 1600, delay: 500, easing: "ease-out" },
  );
}

/**
 * The header spotlight's **Jump to Cover Image** button, left of the site menu button: it scrolls to the photo showing in the
 * header on the page below, its Grid tile or Timeline row, and rings it. When the page doesn't
 * show it, filtered out or in a closed month, it opens the photo in the photo viewer instead.
 */
export function JumpToCover({ photo }: { photo: Photo | undefined }) {
  const { show } = useShownPhoto();
  if (!photo) return null;
  const jump = () => {
    const element = photoElement(photo);
    if (element) spotlight(element);
    else show(photo);
  };
  return (
    <button
      type="button"
      onClick={jump}
      // Beside the site menu button, which is fixed at the top right: 1rem in, 2.25rem wide, and a 0.5rem gap.
      className="absolute top-4 right-15 z-10 flex h-9 items-center gap-1.5 rounded-md border border-white/30 bg-black/40 px-2.5 text-xs font-medium text-white shadow-sm backdrop-blur-md transition-colors outline-none hover:bg-black/60 focus-visible:ring-[3px] focus-visible:ring-white/60"
    >
      <ArrowDownToLine className="size-3.5" aria-hidden />
      Jump to Cover Image
    </button>
  );
}
