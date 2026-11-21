import { createFileRoute } from "@tanstack/react-router";
import { GroupDetailPage } from "@/components/group-detail";
import { AlbumCrumbs } from "@/components/sidebar/route-crumbs";

export const Route = createFileRoute("/albums/$id")({
  component: AlbumDetailPage,
  staticData: { wide: true, crumbs: AlbumCrumbs },
});

function AlbumDetailPage() {
  const { id } = Route.useParams();
  return <GroupDetailPage kind="albums" id={id} />;
}
