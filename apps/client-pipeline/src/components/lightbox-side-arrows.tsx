import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Previous and Next buttons at the sides of an `ImageLightbox`'s image, for a mouse or a touch
 * screen, calling onStep with -1 or 1 as ← and → do.
 */
export function LightboxSideArrows({ onStep }: { onStep: (by: number) => void }) {
  const className =
    "absolute top-1/2 size-12 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white [&_svg]:size-7";
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Previous photo"
        aria-keyshortcuts="ArrowLeft"
        title="Previous photo (←)"
        className={`${className} left-6`}
        onClick={() => onStep(-1)}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next photo"
        aria-keyshortcuts="ArrowRight"
        title="Next photo (→)"
        className={`${className} right-6`}
        onClick={() => onStep(1)}
      >
        <ChevronRightIcon />
      </Button>
    </>
  );
}

/**
 * Moves focus, as a lightbox closes, to the element marked `data-lightbox-photo` with the path of
 * the photo last shown, instead of the one first clicked; nothing when it isn't on the page.
 */
export function focusLightboxPhoto(event: Event, path: string) {
  const image = document.querySelector<HTMLElement>(`[data-lightbox-photo="${CSS.escape(path)}"]`);
  if (!image) return;
  event.preventDefault();
  image.focus();
}
