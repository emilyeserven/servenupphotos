import { createFileRoute } from "@tanstack/react-router";
import { GroupPage } from "@/components/organize-page";

export const Route = createFileRoute("/albums/")({
  component: AlbumsPage,
});

function AlbumsPage() {
  return <GroupPage kind="albums" />;
}
