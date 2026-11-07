import { createFileRoute } from "@tanstack/react-router";
import { GenreSuggestionsCard } from "@/components/genre-suggestions/genre-suggestions-card";
import { CardPage } from "@/components/update-data/card-page";

export const Route = createFileRoute("/genre-suggestions")({
  component: GenreSuggestionsPage,
});

/** The Genre Suggestions page, under Genres in the sidebar. */
function GenreSuggestionsPage() {
  return (
    <CardPage
      title="Genre Suggestions"
      description="Asks an LLM which genres fit photos without any, then reviews them before they're saved."
    >
      <GenreSuggestionsCard />
    </CardPage>
  );
}
