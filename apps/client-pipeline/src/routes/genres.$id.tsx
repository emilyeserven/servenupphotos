import { createFileRoute } from "@tanstack/react-router";
import { GroupDetailPage } from "@/components/group-detail";
import { GenreCrumbs } from "@/components/sidebar/route-crumbs";

export const Route = createFileRoute("/genres/$id")({
  component: GenreDetailPage,
  staticData: { wide: true, crumbs: GenreCrumbs },
});

function GenreDetailPage() {
  const { id } = Route.useParams();
  return <GroupDetailPage kind="genres" id={id} />;
}
