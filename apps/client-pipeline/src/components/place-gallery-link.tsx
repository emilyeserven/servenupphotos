import { Link } from "@tanstack/react-router";
import { ImagesIcon } from "lucide-react";
import type { Place } from "@/api/places";
import { Button } from "@/components/ui/button";
import type { RegionNode } from "@/lib/region-tree";

/**
 * A Places row's photo count: for a place with photos, a link that opens the Gallery showing only
 * them; otherwise just the number.
 */
export function PlacePhotoCount({ node }: { node: RegionNode }) {
  if (!node.place || node.photos === 0) return node.photos;
  return (
    <Link
      to="/gallery"
      search={{ placeId: node.place.id }}
      title={`See ${node.place.name}'s photos in the Gallery`}
      className="underline decoration-dotted underline-offset-4 hover:decoration-solid"
    >
      {node.photos}
    </Link>
  );
}

/** Opens the Gallery showing only the photos given the place. */
export function PlaceGalleryButton({ place }: { place: Place }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/gallery" search={{ placeId: place.id }}>
        <ImagesIcon />
        See photos in Gallery
      </Link>
    </Button>
  );
}
