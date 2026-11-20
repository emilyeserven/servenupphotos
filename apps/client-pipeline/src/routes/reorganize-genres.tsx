import { createFileRoute } from "@tanstack/react-router";
import { ReorganizeGenresCard } from "@/components/genre-tree/reorganize-genres-card";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";

export const Route = createFileRoute("/reorganize-genres")({
  component: ReorganizeGenresPage,
});

/** The Reorganize Genres page, under Genres in the sidebar. */
function ReorganizeGenresPage() {
  return (
    <Page
      title="Reorganize Genres"
      description="Renames, reorders and nests the photographic genres, with subgenres under a broader genre."
      wide
    >
      <GitHubGate>{() => <ReorganizeGenresCard />}</GitHubGate>
    </Page>
  );
}
