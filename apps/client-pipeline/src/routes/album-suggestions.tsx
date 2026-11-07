import { createFileRoute } from "@tanstack/react-router";
import { AlbumSuggestionsCard } from "@/components/album-suggestions/album-suggestions-card";
import { CardPage } from "@/components/update-data/card-page";

export const Route = createFileRoute("/album-suggestions")({
  component: AlbumSuggestionsPage,
});

/** The Album Suggestions page, under Albums in the sidebar. */
function AlbumSuggestionsPage() {
  return (
    <CardPage
      title="Album Suggestions"
      description="Asks an LLM which albums photos without one belong in, then reviews them before they're saved."
    >
      <AlbumSuggestionsCard />
    </CardPage>
  );
}
