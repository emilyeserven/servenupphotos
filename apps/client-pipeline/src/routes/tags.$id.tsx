import { createFileRoute } from "@tanstack/react-router";
import { TagCrumbs } from "@/components/sidebar/route-crumbs";
import { GroupDetailPage } from "@/components/group-detail";

export const Route = createFileRoute("/tags/$id")({
  component: TagDetailPage,
  staticData: { wide: true, crumbs: TagCrumbs },
});

function TagDetailPage() {
  const { id } = Route.useParams();
  return <GroupDetailPage kind="tags" id={id} />;
}
