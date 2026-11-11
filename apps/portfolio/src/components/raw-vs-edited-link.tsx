import { Link } from "@tanstack/react-router";
import { SquareSplitHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Photo } from "@/lib/photos";

/**
 * The photo viewer's Raw vs Edited button, for a photo whose unedited original is shown on the
 * portfolio: opens the photo on the Raw vs Edited page, next to its original. Nothing for other photos.
 */
export function RawVsEditedLink({ photo }: { photo: Photo }) {
  if (!photo.original) return null;
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="text-white hover:bg-white/10 hover:text-white"
    >
      <Link
        to="/raw-vs-edited"
        search={{ photo: photo.id }}
        aria-label="Compare with the unedited original"
        title="Compare with the unedited original"
      >
        <SquareSplitHorizontal />
      </Link>
    </Button>
  );
}
