import { createFileRoute } from "@tanstack/react-router";
import { GenreCrumbs } from "@/components/sidebar/route-crumbs";
import { GroupDetailPage } from "@/components/group-detail";

export const Route = createFileRoute("/genres/$id")({
  component: GenreDetailPage,
  staticData: { wide: true, crumbs: GenreCrumbs },
});

function GenreDetailPage() {
  const { id } = Route.useParams();
  return <GroupDetailPage kind="genres" id={id} />;
}
