import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { photoBookId, photoBooks } from "@/api/photo-books";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { ImportedPages } from "@/components/book-import/imported-pages";
import { MissingPhotos } from "@/components/book-import/missing-photos";
import { useImportBook } from "@/components/book-import/use-import-book";
import { FieldLabel } from "@/components/field-label";
import { HideOnPortfolioCheckbox } from "@/components/hide-on-portfolio-checkbox";
import { UnknownPhotos } from "@/components/paste-answer";
import { bookAlbums } from "@/components/photo-book/album-photos";
import { Input } from "@/components/ui/input";
import { SaveButton } from "@/components/update-data-shared";
import { WaitingForCommit } from "@/components/waiting-for-commit";
import { type BookImport, importedPhotos } from "@/lib/book-import";
import { type ImportChoices, type ImportSaves, importSaves } from "@/lib/book-import-save";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

interface ImportReviewProps {
  read: BookImport;
  data: CombinedData;
  photos: SocialPhoto[];
}

/** Each photo file's photo ID, by its path. */
function photoIdsOf(photos: SocialPhoto[]): Map<string, number> {
  return new Map(
    photos.flatMap((p) => (typeof p.data.id === "number" ? [[p.path, p.data.id] as const] : [])),
  );
}

/** What saving the import with choices does, given the albums and books there are. */
function savesFor(
  read: BookImport,
  choices: ImportChoices,
  data: CombinedData,
  photos: SocialPhoto[],
) {
  const taken = photoBooks(data).map((book) => book.id);
  return importSaves(read, choices, {
    albums: bookAlbums(data),
    photoIds: photoIdsOf(photos),
    bookId: (name) => photoBookId(name, taken),
  });
}

/**
 * The save of an import, and what it saves: `planned` until it's saved, then what was saved, so
 * the review doesn't change to the album and book it just made. Busy from the press on.
 */
function useImportSaves(planned: ImportSaves) {
  const save = useImportBook();
  return {
    save,
    saves: save.variables ?? planned,
    busy: save.isPending || save.isSuccess,
  };
}

/**
 * What the answer makes: the pages, the printed photos that aren't on the website, the name for
 * the album and book, and the button that saves the album and the book for Commit.
 */
export function ImportReview({ read, data, photos }: ImportReviewProps) {
  const [choices, setChoices] = useState(() => startChoices(read));
  const { save, saves, busy } = useImportSaves(savesFor(read, choices, data, photos));
  return (
    <div className="bg-muted/50 flex flex-col gap-4 rounded-md border p-3 text-sm">
      <p>{summary(read)}</p>
      <UnknownPhotos names={read.unknown} noun="pages" />
      <MissingPhotos missing={read.missing} />
      <ImportedPages pages={read.pages} photos={new Map(photos.map((p) => [p.path, p]))} />
      <ImportChoicesFields choices={choices} saves={saves} busy={busy} onChange={setChoices} />
      <SaveButton
        label="Make the album and photo book"
        disabled={busy || !canSave(read, choices)}
        pending={save.isPending}
        error={save.error}
        onClick={() => save.mutate(saves)}
      />
      {save.isSuccess && <Saved bookId={saves.book.id} />}
    </div>
  );
}

/** The answer's name for the book, and a new album hidden on the portfolio, as a working album. */
function startChoices(read: BookImport): ImportChoices {
  return { name: read.name || "Imported book", hidden: true };
}

/** "12 pages, 20 photos on the website, 3 photos not on the website." */
function summary(read: BookImport): string {
  const matched = importedPhotos(read).length;
  return `${count(read.pages.length, "page")}, ${count(matched, "photo")} on the website, ${count(read.missing.length, "photo")} not on the website.`;
}

/** Whether there's a name and a page to save. */
function canSave(read: BookImport, choices: ImportChoices): boolean {
  return choices.name.trim() !== "" && read.pages.length > 0;
}

interface ImportChoicesFieldsProps {
  choices: ImportChoices;
  saves: ImportSaves;
  busy: boolean;
  onChange: (choices: ImportChoices) => void;
}

/** The name for the album and book, what happens to the album, and whether a new one starts hidden. */
function ImportChoicesFields({ choices, saves, busy, onChange }: ImportChoicesFieldsProps) {
  const newAlbum = saves.album.id !== "" && !saves.album.existing;
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <FieldLabel
          htmlFor="book-import-name"
          help="The new album and photo book are both named this. An album's name that's taken adds the photos to that album instead."
        >
          Name
        </FieldLabel>
        <Input
          id="book-import-name"
          className="w-72"
          value={choices.name}
          disabled={busy}
          onChange={(event) => onChange({ ...choices, name: event.target.value })}
        />
        <AlbumNote saves={saves} />
      </div>
      {newAlbum && (
        <HideOnPortfolioCheckbox
          what="the new album"
          checked={choices.hidden}
          disabled={busy}
          onChange={(hidden) => onChange({ ...choices, hidden })}
        />
      )}
    </>
  );
}

/** Whether the photos go in a new album or one already there, or in none without matched photos. */
function AlbumNote({ saves }: { saves: ImportSaves }) {
  if (!saves.albumSave) {
    return (
      <EmptyNote>
        None of the book&apos;s photos are on the website, so only the photo book is made.
      </EmptyNote>
    );
  }
  return (
    <p className="text-muted-foreground">
      {saves.album.existing
        ? "An album has this name already, so the photos are added to it."
        : "A new album is made with the photos, in the book's order."}
    </p>
  );
}

/** What was saved, with a link to the new book. */
function Saved({ bookId }: { bookId: string }) {
  return (
    <p>
      Saved the album and the{" "}
      <Link
        to="/photo-books/$id/$part"
        params={{ id: bookId, part: "book" }}
        className="underline underline-offset-4"
      >
        photo book
      </Link>{" "}
      in the app. <WaitingForCommit what="They" />
    </p>
  );
}
