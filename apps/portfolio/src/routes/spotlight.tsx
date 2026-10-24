import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { SpotlightStrip } from "@/components/spotlight-strip";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";
import { spotlightZones, zonePhotos } from "@/lib/spotlight-zones";

export const Route = createFileRoute("/spotlight")({
  validateSearch: (search: Record<string, unknown>): ShownPhotoSearch => parseShownPhoto(search),
  component: SpotlightView,
});

// Worked out once: the photos only change with a new build.
const zones = spotlightZones.map((zone) => ({ zone, photos: zonePhotos(zone.id) }));
// Every spotlighted photo once, for the lightbox to step through.
const allSpotlighted = [...new Map(zones.flatMap((z) => z.photos).map((p) => [p.id, p])).values()];

/** Each spotlight zone of the site with a strip of the photos picked for it. */
function SpotlightView() {
  const { shown, show, close } = useShownPhoto();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Sparkles className="size-8 text-muted-foreground" aria-hidden />
          Spotlight
        </h1>
        <p className="mt-2 text-muted-foreground">The photos picked for each spot on the site.</p>
      </header>
      {zones.map(({ zone, photos }) => (
        <SpotlightStrip key={zone.id} zone={zone} photos={photos} onOpen={show} />
      ))}
      <PhotoLightbox photo={shown} photos={allSpotlighted} onShow={show} onClose={close} />
    </div>
  );
}
