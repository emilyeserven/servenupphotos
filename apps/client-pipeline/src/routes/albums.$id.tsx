import { createFileRoute } from "@tanstack/react-router";
import { AlbumCrumbs } from "@/components/sidebar/route-crumbs";
import { GroupDetailPage } from "@/components/group-detail";

export const Route = createFileRoute("/albums/$id")({
  component: AlbumDetailPage,
  staticData: { wide: true, crumbs: AlbumCrumbs },
});

function AlbumDetailPage() {
  const { id } = Route.useParams();
  return <GroupDetailPage kind="albums" id={id} />;
}
