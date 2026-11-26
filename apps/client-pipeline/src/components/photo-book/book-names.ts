import { useMemo } from "react";
import type { SocialPhoto } from "@/api/publish";
import { usePhotoFields } from "@/components/photo-book/book-captions";
import type { PhotoBook } from "@/lib/photo-book";
import { nameCounts } from "@/lib/photo-book-lenses";

/**
 * The lens or camera of each photo on the book's pages, as its caption names it before the book
 * changes it, each once with how many photos have it, the most first.
 */
export function useBookNames(book: PhotoBook, photos: SocialPhoto[], field: "lens" | "camera") {
  const fieldsOf = usePhotoFields();
  const byPath = useMemo(() => new Map(photos.map((p) => [p.path, p])), [photos]);
  const names = book.pages.flatMap((page) =>
    page.slots.flatMap(({ photo }) => {
      const found = byPath.get(photo);
      const name = found ? fieldsOf(found)[field] : undefined;
      return typeof name === "string" ? [name] : [];
    }),
  );
  return nameCounts(names);
}
