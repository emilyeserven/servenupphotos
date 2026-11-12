import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, SquareSplitHorizontal } from "lucide-react";
import {
  ComparisonModePicker,
  EditComparison,
  parseComparisonMode,
  type ComparisonMode,
} from "@/components/edit-comparison";
import { SiteHomeLink } from "@/components/site-home-link";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { parseShownPhoto, type ShownPhotoSearch } from "@/lib/shown-photo";

interface RawVsEditedSearch extends ShownPhotoSearch {
  /** How the open photo is compared. Left out for the default, the slider. */
  mode?: Exclude<ComparisonMode, "slider">;
}

/** Reads the open photo and how it's compared from the URL. */
function validateRawVsEditedSearch(search: Record<string, unknown>): RawVsEditedSearch {
  return { ...parseShownPhoto(search), ...parseComparisonMode(search.mode) };
}

export const Route = createFileRoute("/raw-vs-edited")({
  validateSearch: validateRawVsEditedSearch,
  component: RawVsEditedPage,
});

/** A photo with both its edit and its unedited original to show. */
type ComparedPhoto = Photo & { image: PhotoImage; original: PhotoImage };

/** The photos whose unedited original is shown on the portfolio, newest first. */
const compared = photos
  .filter((photo): photo is ComparedPhoto => photo.image !== null && photo.original !== null)
  .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime());

/**
 * The photos shown next to their unedited originals, picked in the pipeline. The list of them, or
 * with `?photo=<id>`, that one compared with its original.
 */
function RawVsEditedPage() {
  const search = Route.useSearch();
  const open = compared.find((photo) => photo.id === search.photo);
  return (
    <div className="flex w-full flex-col gap-6 px-3 py-16 sm:px-4">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-1 sm:px-2">
        <SiteHomeLink className="basis-full" />
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <SquareSplitHorizontal className="size-8 text-muted-foreground" aria-hidden />
          Raw vs Edited
        </h1>
        <p className="text-sm text-muted-foreground">
          {compared.length} {compared.length === 1 ? "photo" : "photos"} next to the unedited
          original, straight from the camera
        </p>
      </header>
      <div className="mx-auto w-full max-w-6xl px-1 sm:px-2">
        {open ? <OpenComparison photo={open} mode={search.mode ?? "slider"} /> : <ComparedList />}
      </div>
    </div>
  );
}

/** One photo and its original, with how they're compared and a way back to the list. */
function OpenComparison({ photo, mode }: { photo: ComparedPhoto; mode: ComparisonMode }) {
  const navigate = Route.useNavigate();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/raw-vs-edited"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All photos
        </Link>
        <h2 className="text-xl font-medium">{photo.title}</h2>
        <div className="ms-auto">
          <ComparisonModePicker
            mode={mode}
            onChange={(next) =>
              void navigate({
                search: (prev) => ({ ...prev, mode: next === "slider" ? undefined : next }),
                replace: true,
              })
            }
          />
        </div>
      </div>
      <EditComparison edited={photo.image} original={photo.original} alt={photo.alt} mode={mode} />
    </div>
  );
}

/** Every compared photo as a tile that opens it, or a note when there are none yet. */
function ComparedList() {
  if (compared.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No photos are shown next to their originals yet.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {compared.map((photo) => (
        <li key={photo.id}>
          <Link
            to="/raw-vs-edited"
            search={{ photo: photo.id }}
            className="group flex flex-col gap-1.5 rounded-md outline-none focus-visible:ring-4 focus-visible:ring-ring"
          >
            <ComparedTile photo={photo} />
            <span className="truncate text-sm group-hover:underline">{photo.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The photo's square, its left half the original and its right half the edit. */
function ComparedTile({ photo }: { photo: ComparedPhoto }) {
  const half = (image: PhotoImage, side: "left" | "right") => (
    <img
      src={image.small}
      alt=""
      loading="lazy"
      className="absolute inset-0 size-full object-cover"
      style={{ clipPath: side === "left" ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)" }}
    />
  );
  return (
    <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
      {half(photo.original, "left")}
      {half(photo.image, "right")}
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/90" />
      <span className="sr-only">{photo.alt}</span>
    </div>
  );
}
