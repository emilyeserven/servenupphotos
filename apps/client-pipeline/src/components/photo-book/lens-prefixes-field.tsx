import { useMemo } from "react";
import type { SocialPhoto } from "@/api/publish";
import { usePhotoFields } from "@/components/photo-book/book-captions";
import { Input } from "@/components/ui/input";
import type { PhotoBook } from "@/lib/photo-book";
import { type LensPrefix, lensCounts, prefixNote, withLensPrefix } from "@/lib/photo-book-lenses";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

/** The lens of each photo on the book's pages, as its caption names it, once a photo. */
function useBookLenses(book: PhotoBook, photos: SocialPhoto[]) {
  const fieldsOf = usePhotoFields();
  const byPath = useMemo(() => new Map(photos.map((p) => [p.path, p])), [photos]);
  const lenses = book.pages.flatMap((page) =>
    page.slots.flatMap(({ photo }) => {
      const found = byPath.get(photo);
      const lens = found ? fieldsOf(found).lens : undefined;
      return typeof lens === "string" ? [lens] : [];
    }),
  );
  return lensCounts(lenses);
}

interface LensRowProps {
  lens: string;
  photos: number;
  prefixes: LensPrefix[] | undefined;
  onChange: (prefix: string) => void;
}

/** One lens: its name, how many photos have it, what to take off its start, and how captions write it then. */
function LensRow({ lens, photos, prefixes, onChange }: LensRowProps) {
  const prefix = prefixes?.find((p) => p.lens === lens)?.prefix ?? "";
  return (
    <li className="grid gap-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] sm:items-center sm:gap-3">
      <span className="text-sm">
        {lens} <span className="text-muted-foreground text-xs">({count(photos, "photo")})</span>
      </span>
      <Input
        aria-label={`Take off the start of ${lens}`}
        value={prefix}
        placeholder={lens.split(" ")[0] ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 text-sm"
      />
      <span className="text-muted-foreground text-xs">{prefixNote(lens, prefixes)}</span>
    </li>
  );
}

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
  const lenses = useBookLenses(book, props.photos);
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
          {lenses.map(({ lens, count: n }) => (
            <LensRow
              key={lens}
              lens={lens}
              photos={n}
              prefixes={book.lensPrefixes}
              onChange={(prefix) => set(lens, prefix)}
            />
          ))}
        </ul>
      )}
    </fieldset>
  );
}
