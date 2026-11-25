import { createFileRoute } from "@tanstack/react-router";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { PhotoBooksList } from "@/components/photo-book/books-list";

export const Route = createFileRoute("/photo-books/")({
  component: PhotoBooksRoute,
});

/** Every photo book, each a rough mockup of a book's pages, linking to its own page. */
function PhotoBooksRoute() {
  return (
    <Page
      title="Photo Books"
      description="Rough mockups of photo books, to plan which photos and captions go on which page before laying a book out for real. Each book takes its photos from an album. Each book is one JSON file, combined into PHOTOBOOKS.json."
    >
      <GitHubGate>{() => <PhotoBooksList />}</GitHubGate>
    </Page>
  );
}
