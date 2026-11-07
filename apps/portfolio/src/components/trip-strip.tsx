import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { StripPhoto } from "@/components/album-strip";
import type { ImagePhoto } from "@/lib/spotlight-zones";
import { pageDates, pageTitle, type TripPage } from "@/lib/trip-pages";

/** How many photos stand for a Trip on the Albums page, as for an album. */
const PREVIEW_COUNT = 5;

/**
 * One Trip page's first 5 photos as a strip, under its name, linked to the page, with its days and
 * how many photos it has. Clicking a photo opens it.
 */
export function TripStrip({
  page,
  photos,
  onOpen,
}: {
  page: TripPage;
  /** The photos the page shows, in order. */
  photos: ImagePhoto[];
  onOpen: (photo: ImagePhoto) => void;
}) {
  return (
    <section aria-labelledby={`trip-${page.id}`} className="flex flex-col gap-3">
      <div>
        <h3 id={`trip-${page.id}`} className="text-xl font-semibold tracking-tight">
          <Link
            to="/albums/trips/$id"
            params={{ id: page.id }}
            className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
          >
            {pageTitle(page)}
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">
          {pageDates(page)}. {photos.length} {photos.length === 1 ? "photo" : "photos"}.
        </p>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
        {photos.slice(0, PREVIEW_COUNT).map((photo) => (
          <li key={photo.id} className="shrink-0 snap-start">
            <StripPhoto photo={photo} onOpen={() => onOpen(photo)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
