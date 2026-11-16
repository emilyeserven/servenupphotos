import { createFileRoute } from "@tanstack/react-router";
import { ReEditList } from "@/components/re-edit-list";
import { CardPage } from "@/components/update-data/card-page";

export const Route = createFileRoute("/re-edit")({
  component: ReEditPage,
});

/** The Re-edit page, under Images in the sidebar: every photo marked for re-editing. */
function ReEditPage() {
  return (
    <CardPage
      title="Re-Edit"
      description="Every photo marked for re-editing, with why, so they can be edited again and their images replaced."
    >
      <ReEditList />
    </CardPage>
  );
}
