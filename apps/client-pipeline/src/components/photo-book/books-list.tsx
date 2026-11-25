import { Link, useNavigate } from "@tanstack/react-router";
import { ImportIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { photoBooks } from "@/api/photo-books";
import type { CombinedData } from "@/api/photos";
import { bookAlbums } from "@/components/photo-book/album-photos";
import { NewBookForm } from "@/components/photo-book/book-bar";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PhotoBook } from "@/lib/photo-book";
import type { BookAlbum } from "@/lib/photo-book-album";
import { bookPages, photosInBook } from "@/lib/photo-book-order";
import { useCombinedData } from "@/stores/combined-data";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

/** The Photo Books page's content: every photo book, each linking to its own page, and New book. */
export function PhotoBooksList() {
  const combined = useCombinedData();
  return (
    <QueryResult query={combined} pendingLabel="Reading the photo books…">
      {(data) => <Books data={data} />}
    </QueryResult>
  );
}

function Books({ data }: { data: CombinedData }) {
  const books = photoBooks(data);
  const albums = bookAlbums(data);
  const navigate = useNavigate();
  const [naming, setNaming] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div>
        {naming ? (
          <NewBookForm
            books={books}
            onCancel={() => setNaming(false)}
            onMade={(id) => void navigate({ to: "/photo-books/$id", params: { id } })}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setNaming(true)}>
              <PlusIcon />
              New book
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/photo-books/import">
                <ImportIcon />
                Import Book
              </Link>
            </Button>
          </div>
        )}
      </div>
      {books.length === 0 && <EmptyNote>No photo books yet.</EmptyNote>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => (
          <li key={book.id}>
            <BookCard book={book} albums={albums} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Photos from Korea", or a note that no album is picked yet. */
function albumText(book: PhotoBook, albums: BookAlbum[]): string {
  if (!book.album) return "No album picked yet";
  const album = albums.find((a) => a.id === book.album);
  return `Photos from ${album?.name || book.album}`;
}

/** "3 pages · 5 photos" in the book, with how many more pages could be used when there are some. */
function pagesText(book: PhotoBook): string {
  const kept = bookPages(book).length;
  const spare = book.pages.length - kept;
  const pages = `${count(kept, "page")}${spare > 0 ? ` (${spare} more not in it)` : ""}`;
  return `${pages} · ${count(photosInBook(book).size, "photo")}`;
}

/** One photo book on the list: its name, album, and the pages and photos in it, linking to its page. */
function BookCard({ book, albums }: { book: PhotoBook; albums: BookAlbum[] }) {
  return (
    <Link
      to="/photo-books/$id"
      params={{ id: book.id }}
      className="hover:ring-ring block h-full rounded-xl hover:ring-2"
    >
      <Card className="h-full">
        <CardHeader>
          <CardTitle>{book.name}</CardTitle>
          <CardDescription className="flex flex-col gap-0.5">
            <span>{albumText(book, albums)}</span>
            <span>{pagesText(book)}</span>
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
