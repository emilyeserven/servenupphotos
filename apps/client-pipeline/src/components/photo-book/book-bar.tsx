import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import type { CaptionTemplate } from "@/api/captions";
import { deletePhotoBookMutation, photoBookId, savePhotoBookMutation } from "@/api/photo-books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PhotoBook } from "@/lib/photo-book";

const SELECT =
  "border-input dark:bg-input/30 h-9 min-w-0 rounded-md border bg-transparent px-2 text-sm shadow-xs";

interface BookChooserProps {
  books: PhotoBook[];
  chosen: PhotoBook | undefined;
  onChoose: (id: string | undefined) => void;
}

/** The book being worked on, chosen from the saved ones, and **New book** to start another. */
export function BookChooser({ books, chosen, onChoose }: BookChooserProps) {
  const [naming, setNaming] = useState(books.length === 0);
  if (naming || !chosen) {
    return (
      <NewBookForm
        books={books}
        onCancel={books.length > 0 ? () => setNaming(false) : undefined}
        onMade={(id) => {
          setNaming(false);
          onChoose(id);
        }}
      />
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Photo book"
        value={chosen.id}
        onChange={(event) => onChoose(event.target.value)}
        className={SELECT}
      >
        {books.map((book) => (
          <option key={book.id} value={book.id}>
            {book.name}
          </option>
        ))}
      </select>
      <Button variant="outline" onClick={() => setNaming(true)}>
        <PlusIcon />
        New book
      </Button>
      <DeleteBookButton book={chosen} onDeleted={() => onChoose(undefined)} />
    </div>
  );
}

interface NewBookFormProps {
  books: PhotoBook[];
  onCancel?: () => void;
  onMade: (id: string) => void;
}

/** A name for a new book, saved with one full page to start from. */
function NewBookForm({ books, onCancel, onMade }: NewBookFormProps) {
  const [name, setName] = useState("");
  const save = useMutation(savePhotoBookMutation);
  const make = () => {
    const id = photoBookId(
      name,
      books.map((b) => b.id),
    );
    const book: PhotoBook = { id, name: name.trim(), template: "", pages: [] };
    save.mutate(book, { onSuccess: () => onMade(id) });
  };
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) make();
      }}
    >
      <Input
        aria-label="New book's name"
        placeholder="Name the book, such as Korea 2026"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-64"
        autoFocus
      />
      <Button type="submit" disabled={!name.trim() || save.isPending}>
        <PlusIcon />
        Make book
      </Button>
      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      )}
      {save.error && <p className="text-destructive text-sm">{save.error.message}</p>}
    </form>
  );
}

/** Removes the book, after asking, as a change waiting for Commit. */
function DeleteBookButton({ book, onDeleted }: { book: PhotoBook; onDeleted: () => void }) {
  const remove = useMutation(deletePhotoBookMutation);
  return (
    <Button
      variant="ghost"
      disabled={remove.isPending}
      onClick={() => {
        if (window.confirm(`Remove the photo book “${book.name}”?`))
          remove.mutate(book.id, { onSuccess: onDeleted });
      }}
    >
      <Trash2Icon />
      Remove book
    </Button>
  );
}

interface BookSettingsProps {
  book: PhotoBook;
  templates: CaptionTemplate[];
  /** The template the captions are filled in with now. */
  template: CaptionTemplate | undefined;
  onChange: (book: PhotoBook) => void;
}

/** The book's name and the caption template its captions are filled in with. */
export function BookSettings({ book, templates, template, onChange }: BookSettingsProps) {
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
