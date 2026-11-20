import { createFileRoute } from "@tanstack/react-router";
import { GroupDetailPage } from "@/components/group-detail";
import { TagCrumbs } from "@/components/sidebar/route-crumbs";

export const Route = createFileRoute("/tags/$id")({
  component: TagDetailPage,
  staticData: { wide: true, crumbs: TagCrumbs },
});

function TagDetailPage() {
  const { id } = Route.useParams();
  return <GroupDetailPage kind="tags" id={id} />;
}
