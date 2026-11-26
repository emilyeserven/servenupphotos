import { useMemo } from "react";
import type { SocialPhoto } from "@/api/publish";
import { usePhotoFields } from "@/components/photo-book/book-captions";
import { captionLists } from "@/lib/caption-template";
import type { PhotoBook } from "@/lib/photo-book";
import type { GeneratedPage } from "@/lib/photo-book-generated";
import { bookSlots } from "@/lib/photo-book-order";
import { type IndexEntry, placesIndex } from "@/lib/photo-book-places-index";
import { useCombinedData } from "@/stores/combined-data";

/**
 * The Places Index a generated page shows, from the photos on the pages in the book, in its order,
 * each with its changes not committed yet, so the page is current every time it's drawn.
 */
export function usePlacesIndexFor(
  book: PhotoBook,
  photos: Map<string, SocialPhoto>,
): (generated: GeneratedPage) => IndexEntry[] {
  const { data } = useCombinedData();
  const lists = useMemo(() => captionLists(data), [data]);
  const fieldsOf = usePhotoFields();
  const fields = bookSlots(book).flatMap(({ slot }) => {
    const photo = photos.get(slot.photo);
    return photo ? [fieldsOf(photo)] : [];
  });
  return (generated) => placesIndex(fields, lists, generated);
}
