import type { LngLatBounds } from "maplibre-gl";
import { CheckIcon, LinkIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { mapPageFor } from "@/lib/map-pages";
import type { PlacedPhoto } from "@/lib/map-photos";

/** The address of the map page to share for the photos in view (see `mapPageFor`). */
function mapPageUrl(drawn: PlacedPhoto[], view: LngLatBounds | null): string {
  const inView = view ? drawn.filter((p) => view.contains([p.longitude, p.latitude])) : [];
  return new URL(mapPageFor(inView).path, window.location.origin).href;
}

/**
 * The map's Copy link button: copies the link to the map page for the place the photos in view
 * are all in, or the whole map, which shows a picture of that view when shared on social media or
 * in a chat, then shows a check for a moment.
 */
export function CopyMapLinkButton({
  drawn,
  view,
}: {
  /** The photos the map draws. */
  drawn: PlacedPhoto[];
  /** What the map shows, or null before it's drawn. */
  view: LngLatBounds | null;
}) {
  const [justCopied, setJustCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={justCopied ? "Link copied" : "Copy link"}
      title="Copy a link that shows a map of this place when shared"
      onClick={() => {
        void navigator.clipboard.writeText(mapPageUrl(drawn, view)).then(() => {
          setJustCopied(true);
          setTimeout(() => setJustCopied(false), 2000);
        });
      }}
    >
      {justCopied ? <CheckIcon /> : <LinkIcon className="text-muted-foreground" />}
      {/* Just the icon on phones, so the map's controls fit on one row. */}
      <span className="max-md:sr-only">Copy link</span>
    </Button>
  );
}
