import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { photoBooks } from "@/api/photo-books";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { BookEditor } from "@/components/photo-book/book-editor";
import { DecidedPhotoFiles } from "@/components/photo-files";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { useCombinedData } from "@/stores/combined-data";

/** One photo book's page, from the Photo Books page: its album, its pages and their captions. */
export function PhotoBookPage({ id }: { id: string }) {
  const combined = useCombinedData();
  const book = photoBooks(combined.data).find((b) => b.id === id);
  return (
    <Page
      wide
      title={book?.name ?? "Photo book"}
      description="A rough mockup of the book's pages. Pick the album its photos come from, add pages in any layout, and drag the album's photos onto them; leave a page out of the book to try another way of laying it out. Captions fill in from a caption template."
      action={<BackToBooks />}
    >
      <GitHubGate>{() => <BookContent id={id} />}</GitHubGate>
    </Page>
  );
}

function BackToBooks() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/photo-books">
        <ArrowLeft />
        All photo books
      </Link>
    </Button>
  );
}

function BookContent({ id }: { id: string }) {
  const combined = useCombinedData();
  return (
    <DecidedPhotoFiles>
      {(photos) => (
        <QueryResult query={combined} pendingLabel="Reading the photo books…">
          {(data) => <BookFound id={id} data={data} photos={photos} />}
        </QueryResult>
      )}
    </DecidedPhotoFiles>
  );
}

/** The book the URL names, in its editor. */
function BookFound(props: { id: string; data: CombinedData; photos: SocialPhoto[] }) {
  const { id, data, photos } = props;
  const navigate = useNavigate();
  const book = photoBooks(data).find((b) => b.id === id);
  if (!book) {
    return (
      <p className="text-muted-foreground text-sm">There's no photo book with the ID “{id}”.</p>
    );
  }
  return (
    <BookEditor
      key={book.id}
      saved={book}
      photos={photos}
      data={data}
      onRemoved={() => void navigate({ to: "/photo-books" })}
    />
  );
}
