import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { PhotoDrawerToggle } from "@/components/instagram-picker/photo-drawer";
import { bookAlbums } from "@/components/photo-book/album-photos";
import { BookSettings, DeleteBookButton } from "@/components/photo-book/book-bar";
import { useBookTemplate, useCaptionFor } from "@/components/photo-book/book-captions";
import { BookTab } from "@/components/photo-book/book-tab";
import type { PageLook } from "@/components/photo-book/page-actions";
import { PagesTab } from "@/components/photo-book/pages-tab";
import { usePhotoBookDraft } from "@/components/photo-book/use-photo-book";
import { SaveState } from "@/components/save-state";
import type { PhotoBook } from "@/lib/photo-book";
import { cn } from "@/lib/utils";

/** A book's two tabs: Pages makes the pages that could be used, Book orders the ones that will be. */
export type BookPart = "pages" | "book";

/** Each tab's name, in the order they're shown. */
export const BOOK_PARTS: Record<BookPart, string> = { pages: "Pages", book: "Book" };

interface BookEditorProps {
  saved: PhotoBook;
  /** Every photo file but the Undecided ones, to find the pages' photos in. */
  photos: SocialPhoto[];
  data: CombinedData;
  part: BookPart;
  /** Called once the book is removed. */
  onRemoved: () => void;
}

/**
 * The open book: its name, album and caption template, then its Pages tab, where pages that could
 * be used are made, or its Book tab, where the ones that will be used are put in order.
 */
export function BookEditor({ saved, photos, data, part, onRemoved }: BookEditorProps) {
  const { book, update, error, saving } = usePhotoBookDraft(saved);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const albums = useMemo(() => bookAlbums(data), [data]);
  const byPath = useMemo(() => new Map(photos.map((p) => [p.path, p])), [photos]);
  const { templates, template } = useBookTemplate(book);
  const look: PageLook = { photos: byPath, captionFor: useCaptionFor(byPath, template) };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <BookSettings
          book={book}
          albums={albums}
          templates={templates}
          template={template}
          onChange={update}
        />
        <div className="flex items-center gap-2">
          <SaveState saving={saving} error={error} />
          <DeleteBookButton book={book} onDeleted={onRemoved} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PartTabs id={book.id} part={part} />
        {part === "pages" && (
          <PhotoDrawerToggle open={drawerOpen} onToggle={() => setDrawerOpen(!drawerOpen)} />
        )}
      </div>
      {part === "pages" ? (
        <PagesTab
          book={book}
          update={update}
          look={look}
          data={data}
          photos={photos}
          drawer={drawerOpen ? () => setDrawerOpen(false) : undefined}
        />
      ) : (
        <BookTab book={book} update={update} look={look} />
      )}
    </div>
  );
}

/** The book's two tabs, each a link. */
function PartTabs({ id, part }: { id: string; part: BookPart }) {
  return (
    <nav
      aria-label="This book's tabs"
      className="bg-muted text-muted-foreground inline-flex w-fit items-center rounded-lg p-1"
    >
      {(Object.keys(BOOK_PARTS) as BookPart[]).map((p) => (
        <Link
          key={p}
          to="/photo-books/$id/$part"
          params={{ id, part: p }}
          aria-current={p === part ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium",
            p === part && "bg-background text-foreground shadow-sm",
          )}
        >
          {BOOK_PARTS[p]}
        </Link>
      ))}
    </nav>
  );
}
