import { createFileRoute } from "@tanstack/react-router";
import { GroupPage } from "@/components/organize-page";

export const Route = createFileRoute("/genres/")({
  component: GenresPage,
});

function GenresPage() {
  return <GroupPage kind="genres" />;
}
