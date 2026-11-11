import { createFileRoute } from "@tanstack/react-router";
import { type GridFilters, parseGridFilters } from "@/components/gallery/grid-filters";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { PhotoBookPlanner } from "@/components/photo-book/photo-book-page";

/** The Photo Book page's search: the book open, and the drawer's portfolio Grid filters. */
type PhotoBookSearch = GridFilters & {
  /** The ID of the book open; the first one when left out. */
  book?: string;
};

export const Route = createFileRoute("/photo-book")({
  component: PhotoBookRoute,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): PhotoBookSearch => ({
    ...parseGridFilters(search),
    book: typeof search.book === "string" && search.book ? search.book : undefined,
  }),
});

/** Rough mockups of photo books, page by page, to plan one before laying it out for real. */
function PhotoBookRoute() {
  return (
    <Page
      wide
      title="Photo Book"
      description="Rough mockups of a photo book's pages, to plan which photos and captions go together before laying it out for real. Drag photos from the drawer onto pages; captions fill in from a caption template. Each book is one JSON file, combined into PHOTOBOOKS.json."
    >
      <GitHubGate>{() => <PhotoBookPlanner />}</GitHubGate>
    </Page>
  );
}
