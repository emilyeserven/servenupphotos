import { createFileRoute } from "@tanstack/react-router";
import { PhotoBookPage } from "@/components/photo-book/photo-book-page";
import { PhotoBookCrumbs } from "@/components/sidebar/route-crumbs";

export const Route = createFileRoute("/photo-books/$id")({
  component: PhotoBookRoute,
  staticData: { wide: true, crumbs: PhotoBookCrumbs },
});

function PhotoBookRoute() {
  const { id } = Route.useParams();
  return <PhotoBookPage id={id} />;
}
