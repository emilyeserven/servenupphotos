import { createFileRoute } from "@tanstack/react-router";
import { GroupDetailPage } from "@/components/group-detail";

export const Route = createFileRoute("/albums/$id")({
  component: AlbumDetailPage,
  staticData: { wide: true },
});

function AlbumDetailPage() {
  const { id } = Route.useParams();
  return <GroupDetailPage kind="albums" id={id} />;
}
