import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import type { CaptionTemplate } from "@/api/captions";
import { deletePhotoBookMutation, photoBookId, savePhotoBookMutation } from "@/api/photo-books";
import { NewEntryForm } from "@/components/new-entry-form";
import { AlbumSelect } from "@/components/photo-book/album-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PhotoBook } from "@/lib/photo-book";
import type { BookAlbum } from "@/lib/photo-book-album";
import { askFirst } from "@/stores/confirm";

const SELECT =
  "border-input dark:bg-input/30 h-9 min-w-0 rounded-md border bg-transparent px-2 text-sm shadow-xs";

interface NewBookFormProps {
  books: PhotoBook[];
  onCancel?: () => void;
  onMade: (id: string) => void;
}

/** A name for a new book, saved with no album or pages to start from. */
export function NewBookForm({ books, onCancel, onMade }: NewBookFormProps) {
  const save = useMutation(savePhotoBookMutation);
  const make = (name: string) => {
    const id = photoBookId(
      name,
      books.map((b) => b.id),
    );
    save.mutate({ id, name, template: "", album: "", pages: [] }, { onSuccess: () => onMade(id) });
  };
  return (
    <NewEntryForm
      label="New book's name"
      placeholder="Name the book, such as Korea 2026"
      submit="Make book"
      pending={save.isPending}
      error={save.error}
      onMake={make}
      onCancel={onCancel}
    />
  );
}

/** Removes the book, after asking, as a change waiting for Commit. */
export function DeleteBookButton({ book, onDeleted }: { book: PhotoBook; onDeleted: () => void }) {
  const remove = useMutation(deletePhotoBookMutation);
  return (
    <Button
      variant="ghost"
      disabled={remove.isPending}
      onClick={async () => {
        const yes = await askFirst({
          question: `Remove the photo book “${book.name}”?`,
          action: "Remove book",
        });
        if (yes) remove.mutate(book.id, { onSuccess: onDeleted });
      }}
    >
      <Trash2Icon />
      Remove book
    </Button>
  );
}

interface BookSettingsProps {
  book: PhotoBook;
  /** The albums the book can take its photos from. */
  albums: BookAlbum[];
  templates: CaptionTemplate[];
  /** The template the captions are filled in with now. */
  template: CaptionTemplate | undefined;
  onChange: (book: PhotoBook) => void;
}

/** The book's name, the album its photos come from, and the caption template for its captions. */
export function BookSettings({ book, albums, templates, template, onChange }: BookSettingsProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Name</span>
        <Input
          value={book.name}
          onChange={(event) => onChange({ ...book, name: event.target.value })}
          className="w-64"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Photos from</span>
        <AlbumSelect
          albums={albums}
          value={book.album}
          onChange={(album) => onChange({ ...book, album })}
          className={SELECT}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Captions from</span>
        {templates.length === 0 ? (
          <span className="text-muted-foreground h-9 text-xs leading-9">
            No{" "}
            <Link to="/caption-templates" className="underline underline-offset-4">
              caption templates
            </Link>{" "}
            yet
          </span>
        ) : (
          <select
            value={template?.id ?? ""}
            onChange={(event) => onChange({ ...book, template: event.target.value })}
            className={SELECT}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </label>
    </div>
  );
}
