import { createFileRoute } from "@tanstack/react-router";
import { type GridFilters, parseGridFilters } from "@/components/gallery/grid-filters";
import { BioEditorPage } from "@/components/bio/bio-page";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";

export const Route = createFileRoute("/bio")({
  component: BioRoute,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): GridFilters => parseGridFilters(search),
});

/** The bio the portfolio will show about the photographer, with its photos in order. */
function BioRoute() {
  return (
    <Page
      wide
      title="Bio"
      description="The bio the portfolio will show about you, written in Markdown, with its photos in the order it shows them: self-portraits that are only on the bio, and any of the portfolio's own photos. It's one JSON file, combined into BIO.json."
    >
      <GitHubGate>{() => <BioEditorPage />}</GitHubGate>
    </Page>
  );
}
