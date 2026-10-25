import { createFileRoute } from "@tanstack/react-router";
import { GroupDetailPage } from "@/components/group-detail";

export const Route = createFileRoute("/genres/$id")({
  component: GenreDetailPage,
  staticData: { wide: true },
});

function GenreDetailPage() {
  const { id } = Route.useParams();
  return <GroupDetailPage kind="genres" id={id} />;
}
