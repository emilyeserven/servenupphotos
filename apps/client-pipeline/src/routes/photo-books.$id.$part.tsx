import { createFileRoute } from "@tanstack/react-router";
import type { BookPart } from "@/components/photo-book/book-editor";
import { PhotoBookPage } from "@/components/photo-book/photo-book-page";
import { PhotoBookCrumbs } from "@/components/sidebar/route-crumbs";

export const Route = createFileRoute("/photo-books/$id/$part")({
  component: PhotoBookRoute,
  staticData: { wide: true, crumbs: PhotoBookCrumbs },
});

/** The tab the URL names; Pages for one the page doesn't know. */
function bookPart(part: string): BookPart {
  return part === "book" ? "book" : "pages";
}

function PhotoBookRoute() {
  const { id, part } = Route.useParams();
  return <PhotoBookPage id={id} part={bookPart(part)} />;
}
