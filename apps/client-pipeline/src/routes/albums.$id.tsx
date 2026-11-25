import { createFileRoute } from "@tanstack/react-router";
import { AlbumPage } from "@/components/album-page/album-page";
import { AlbumCrumbs } from "@/components/sidebar/route-crumbs";

/** One album's page, whose Photos, Info and Layout tabs are the routes under it. */
export const Route = createFileRoute("/albums/$id")({
  component: AlbumDetailPage,
  staticData: { wide: true, crumbs: AlbumCrumbs },
});

function AlbumDetailPage() {
  const { id } = Route.useParams();
  return <AlbumPage id={id} />;
}
