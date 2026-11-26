import type { SocialPhoto } from "@/api/publish";
import { BookNameRow } from "@/components/photo-book/book-name-row";
import { useBookNames } from "@/components/photo-book/book-names";
import type { PhotoBook } from "@/lib/photo-book";
import { prefixNote, withLensPrefix } from "@/lib/photo-book-lenses";
import { EmptyNote } from "@portfolio/components/empty-note";

/**
 * **Lens names** on a book's Info tab: each lens of the photos on its pages, with what the book's
 * captions take off the start of its name, such as "Fujinon " for "XF35mmF2 R WR", and how they
 * write it then. Only the book's captions change, not the photos' data.
 */
export function LensPrefixesField(props: {
  book: PhotoBook;
  photos: SocialPhoto[];
  onChange: (book: PhotoBook) => void;
}) {
  const { book, onChange } = props;
  const lenses = useBookNames(book, props.photos, "lens");
  const set = (lens: string, prefix: string) =>
    onChange({ ...book, lensPrefixes: withLensPrefix(book.lensPrefixes, lens, prefix) });
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Lens names</legend>
      <p className="text-muted-foreground text-xs">
        Type what this book&apos;s captions leave off the start of a lens&apos;s name, such as
        &quot;Fujinon &quot;. Only the captions change, not the photos&apos; data.
      </p>
      {lenses.length === 0 ? (
        <EmptyNote>No photo on the book&apos;s pages has a lens yet.</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-2">
          {lenses.map(({ name: lens, count: n }) => (
            <BookNameRow
              key={lens}
              name={lens}
              photos={n}
              value={book.lensPrefixes?.find((p) => p.lens === lens)?.prefix ?? ""}
              placeholder={lens.split(" ")[0] ?? ""}
              label={`Take off the start of ${lens}`}
              note={prefixNote(lens, book.lensPrefixes)}
              onChange={(prefix) => set(lens, prefix)}
            />
          ))}
        </ul>
      )}
    </fieldset>
  );
}
