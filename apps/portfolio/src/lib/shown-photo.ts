import { useNavigate, useSearch } from "@tanstack/react-router";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";

/** A photo with resized versions in R2, which is all the lightbox can show. */
type ImagePhoto = Photo & { image: PhotoImage };

/** The photo open in the lightbox, by its ID, as the URL keeps it; left out while none is. */
export interface ShownPhotoSearch {
  photo?: number;
}

/** Every photo the lightbox can show, by its ID. */
const showableById = new Map(
  photos.flatMap((photo): [number, ImagePhoto][] =>
    photo.image ? [[photo.id, { ...photo, image: photo.image }]] : [],
  ),
);

/** The open photo's ID from the URL's search, leaving it out unless it's a whole number. */
export function parseShownPhoto(search: Record<string, unknown>): ShownPhotoSearch {
  const id = Number(search.photo);
  return Number.isInteger(id) && id > 0 ? { photo: id } : {};
}

/**
 * The photo open in the lightbox, kept in the URL as `?photo=<id>` so a link opens it, and how to
 * show another or close it. Each replaces the URL rather than adding to the history, so Back
 * leaves the view instead of stepping back through the photos.
 */
export function useShownPhoto() {
  const { photo } = parseShownPhoto(useSearch({ strict: false }));
  const navigate = useNavigate();
  function setPhoto(id: number | undefined) {
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, photo: id }),
      replace: true,
    });
  }
  return {
    shown: showableById.get(photo ?? 0) ?? null,
    show: (next: Photo) => setPhoto(next.id),
    close: () => setPhoto(undefined),
  };
}
