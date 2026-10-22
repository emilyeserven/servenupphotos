import { createFileRoute } from "@tanstack/react-router";
import { GroupDetailPage } from "@/components/group-detail";

export const Route = createFileRoute("/tags/$id")({
  component: TagDetailPage,
  staticData: { wide: true },
});

function TagDetailPage() {
  const { id } = Route.useParams();
  return <GroupDetailPage kind="tags" id={id} />;
}
