import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { SpotlightPreview } from "@/components/spotlight-preview";
import { Button } from "@/components/ui/button";
import type { CombinedPhoto } from "@/lib/group-photos";
import { combinedPreview } from "@/lib/spotlight-preview";

/**
 * A spotlight zone's photos one at a time, as the homepage shows them on a phone and a computer,
 * with buttons for the photo before and after. Photos without resized versions are left out, as
 * the portfolio leaves them out.
 */
export function ZonePreview({ photos }: { photos: CombinedPhoto[] }) {
  const previews = photos.flatMap((photo) => combinedPreview(photo) ?? []);
  const [index, setIndex] = useState(0);
  const at = index % Math.max(previews.length, 1);
  const photo = previews.at(at);
  if (!photo) return null;
  const step = (by: number) => setIndex((at + by + previews.length) % previews.length);
  return (
    <div className="flex max-w-2xl flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Preview</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Photo before" onClick={() => step(-1)}>
            <ChevronLeft />
          </Button>
          <span className="text-muted-foreground min-w-16 text-center text-xs tabular-nums">
            {at + 1} of {previews.length}
          </span>
          <Button variant="outline" size="icon" aria-label="Photo after" onClick={() => step(1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <SpotlightPreview photo={photo} />
    </div>
  );
}
