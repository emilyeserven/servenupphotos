import { createFileRoute } from "@tanstack/react-router";
import { GroupPage } from "@/components/organize-page";

export const Route = createFileRoute("/tags/")({
  component: TagsPage,
});

function TagsPage() {
  return <GroupPage kind="tags" />;
}
