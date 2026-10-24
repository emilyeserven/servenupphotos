import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { mapViewOf } from "@/components/view-on-map-link";
import type { Photo } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** The frosted glass the homepage's title, tiles and caption sit on. */
export const FROSTED =
  "border border-white/30 bg-white/20 shadow-xl backdrop-blur-xl backdrop-saturate-150";

/**
 * How a caption fades, the same as its photo. It's set on each frosted part rather than the
 * caption, since an element fading over them would hide the photo from their blur until it ends.
 */
const FADE = "transition-opacity duration-2000 motion-reduce:transition-none";

/**
 * A backdrop photo's title at the bottom left, on frosted glass, with a button before it that
 * opens the Map zoomed in on where the photo was taken. Photos the map can't place get the title
 * alone. It fades in and out with its photo, and can't be reached while it's hidden.
 */
export function BackdropCaption({ photo, seen }: { photo: Photo; seen: boolean }) {
  const view = mapViewOf(photo);
  const fade = cn(FADE, seen ? "opacity-100" : "opacity-0");
  return (
    <div
      inert={!seen}
      className="absolute bottom-4 left-4 flex max-w-[calc(100%-2rem)] items-center gap-2 text-white"
    >
      {view && (
        <Link
          to="/map"
          search={view}
          aria-label={`Show ${photo.title} on the map`}
          title="Show on the map"
          className={cn(
            FROSTED,
            fade,
            "grid size-8 shrink-0 place-items-center rounded-md transition-[opacity,background-color,border-color] outline-none hover:border-white/50 hover:bg-white/30 focus-visible:ring-[3px] focus-visible:ring-white/60",
          )}
        >
          <MapPin className="size-4" aria-hidden />
        </Link>
      )}
      <p className={cn(FROSTED, fade, "truncate rounded-md px-2.5 py-1.5 text-xs")}>
        {photo.title}
      </p>
    </div>
  );
}
