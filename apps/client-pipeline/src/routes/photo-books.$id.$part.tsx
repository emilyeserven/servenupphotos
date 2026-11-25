import { createFileRoute } from "@tanstack/react-router";
import { bookPart } from "@/components/photo-book/book-editor";
import { PhotoBookPage } from "@/components/photo-book/photo-book-page";
import { PhotoBookCrumbs } from "@/components/sidebar/route-crumbs";

export const Route = createFileRoute("/photo-books/$id/$part")({
  component: PhotoBookRoute,
  staticData: { wide: true, crumbs: PhotoBookCrumbs },
});

function PhotoBookRoute() {
  const { id, part } = Route.useParams();
  return <PhotoBookPage id={id} part={bookPart(part)} />;
}
