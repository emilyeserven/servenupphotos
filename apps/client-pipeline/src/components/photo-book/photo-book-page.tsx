import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { photoBooks } from "@/api/photo-books";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { type BookPart, BookEditor } from "@/components/photo-book/book-editor";
import { DecidedPhotoFiles } from "@/components/photo-files";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { useCombinedData } from "@/stores/combined-data";

/**
 * One photo book's page, from the Photo Books page: its album and caption template, then its Pages
 * or Book tab, as part says.
 */
export function PhotoBookPage({ id, part }: { id: string; part: BookPart }) {
  const combined = useCombinedData();
  const book = photoBooks(combined.data).find((b) => b.id === id);
  return (
    <Page
      wide
      title={book?.name ?? "Photo book"}
      description="A rough mockup of the book. On Info, pick the album its photos come from, its caption template and its page size. On Photo Pages, make pages that could be used, in any layout, from the album's photos, trying out as many as you like, and link pages into spreads. On Book, put the ones that will be used in order, add other pages, and page through it."
      action={<BackToBooks />}
    >
      <GitHubGate>{() => <BookContent id={id} part={part} />}</GitHubGate>
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

function BookContent({ id, part }: { id: string; part: BookPart }) {
  const combined = useCombinedData();
  return (
    <DecidedPhotoFiles>
      {(photos) => (
        <QueryResult query={combined} pendingLabel="Reading the photo books…">
          {(data) => <BookFound id={id} part={part} data={data} photos={photos} />}
        </QueryResult>
      )}
    </DecidedPhotoFiles>
  );
}

/** The book the URL names, in its editor. */
function BookFound(props: {
  id: string;
  part: BookPart;
  data: CombinedData;
  photos: SocialPhoto[];
}) {
  const { id, part, data, photos } = props;
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
      part={part}
      onRemoved={() => void navigate({ to: "/photo-books" })}
    />
  );
}
