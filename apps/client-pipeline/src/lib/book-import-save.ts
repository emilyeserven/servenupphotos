import type { AlbumSuggestions } from "@/api/album-suggestions";
import type { Group } from "@/api/organize";
import { type BookImport, importedBook, importedPhotos } from "@/lib/book-import";
import type { PhotoBook } from "@/lib/photo-book";
import { albumFor } from "@/lib/shared-likes";

/** How many photo files one album save takes, as the backend allows. */
const PHOTOS_PER_SAVE = 50;

/** What the review chose: the name for the album and book, and whether the album starts hidden. */
export interface ImportChoices {
  name: string;
  hidden: boolean;
}

/** What else an import has to know: the albums there are, the book IDs taken, and each photo file's ID. */
export interface ImportContext {
  albums: Pick<Group, "id" | "name">[];
  /** Makes the new book's ID from its name, unless another book has it. */
  bookId: (name: string) => string;
  /** Each photo file's photo ID, by its path. */
  photoIds: ReadonlyMap<string, number>;
}

/** Everything an import saves, in order. */
export interface ImportSaves {
  /** The album's ID, and whether it's an album already (its photos are added to it). */
  album: { id: string; existing: boolean };
  /** The album saves, 50 photos at a time; the first makes the album when it's new. None without photos. */
  albumSaves: AlbumSuggestions[];
  /** The new album's photo order, the book's order; empty for an existing album, which keeps its own. */
  photoOrder: number[];
  book: PhotoBook;
}

/** list in pieces of size. */
function chunks<T>(list: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, (i + 1) * size),
  );
}

/**
 * What importing `read` saves: an album (new, or the existing one with the chosen name) with every
 * matched photo, in the book's order when it's new, and a photo book of the same pages taking its
 * photos from that album. Without any matched photo, only the book is saved, with no album.
 */
export function importSaves(
  read: BookImport,
  choices: ImportChoices,
  context: ImportContext,
): ImportSaves {
  const name = choices.name.trim();
  const paths = importedPhotos(read);
  const album = paths.length > 0 ? albumFor(name, context.albums) : { id: "", existing: false };
  const newAlbums =
    album.id && !album.existing
      ? [{ id: album.id, name, description: read.description, hidden: choices.hidden }]
      : [];
  const albumSaves = album.id
    ? chunks(paths, PHOTOS_PER_SAVE).map((part, i) => ({
        newAlbums: i === 0 ? newAlbums : [],
        photos: part.map((path) => ({ path, albums: [album.id] })),
      }))
    : [];
  const photoOrder = album.existing
    ? []
    : paths.flatMap((path) => context.photoIds.get(path) ?? []);
  const book = importedBook(read, { id: context.bookId(name), name, album: album.id });
  return { album, albumSaves, photoOrder, book };
}
