import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { SiteHomeLink } from "@/components/site-home-link";
import { TripStory } from "@/components/trip-story";
import { photos } from "@/lib/photos";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";
import { newestWithImages } from "@/lib/spotlight-zones";
import {
  pageCaptions,
  pageDates,
  pageTitle,
  shownPhotos,
  storyDays,
  type TripPage,
  tripPages,
} from "@/lib/trip-pages";

export const Route = createFileRoute("/albums/trips/$id")({
  validateSearch: (search: Record<string, unknown>): ShownPhotoSearch => parseShownPhoto(search),
  component: TripView,
});

/** The page's column of header and story. */
const PAGE = "flex w-full flex-col gap-8 py-16";

/** The text's column, narrower than the photos. */
const NARROW = "mx-auto w-full max-w-5xl px-4 sm:px-6";

/** A Trip page: the story of a Trip's days, written on the pipeline's Trip Lines page. */
function TripView() {
  const { id } = Route.useParams();
  const page = tripPages.find((p) => p.id === id);
  return (
    <div className={PAGE}>
      <TripHeader title={page ? pageTitle(page) : "No Trip"} dates={page && pageDates(page)} />
      {page ? (
        <TripFound page={page} />
      ) : (
        <p className={`${NARROW} text-muted-foreground`}>There&apos;s no Trip with the ID {id}.</p>
      )}
    </div>
  );
}

/** The link back to the Albums page, then the Trip's name and days. */
function TripHeader({ title, dates }: { title: string; dates?: string }) {
  return (
    <header className={NARROW}>
      <SiteHomeLink className="mb-2 block w-fit" />
      <Link
        to="/albums"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Albums
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
      {dates && <p className="mt-2 text-muted-foreground">{dates}</p>}
    </header>
  );
}

/** The Trip's days and their photos, each photo opening the viewer, which steps through them all. */
function TripFound({ page }: { page: TripPage }) {
  const { shown, show, close } = useShownPhoto();
  const days = storyDays(page, newestWithImages(photos));
  const inOrder = shownPhotos(days);
  return (
    <>
      <p className={`${NARROW} text-sm text-muted-foreground`}>
        {inOrder.length} {inOrder.length === 1 ? "photo" : "photos"}.
      </p>
      <TripStory days={days} captions={pageCaptions(page)} onOpen={show} />
      <PhotoLightbox photo={shown} photos={inOrder} onShow={show} onClose={close} />
    </>
  );
}
