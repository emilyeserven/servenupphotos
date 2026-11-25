import type { PhotoBook } from "@/lib/photo-book";

/**
 * **Page titles** on a book's Info tab: whether its pages show their titles. Off, no page shows one,
 * whatever its layout says, and the titles typed are kept for turning them back on; a text page's
 * title is its heading, so it still shows.
 */
export function TitlesField(props: { book: PhotoBook; onChange: (book: PhotoBook) => void }) {
  const { book, onChange } = props;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Page titles</legend>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={book.noTitles !== true}
          onChange={(event) => {
            const { noTitles: _noTitles, ...rest } = book;
            onChange(event.target.checked ? rest : { ...book, noTitles: true });
          }}
        />
        Show page titles
      </label>
      <p className="text-muted-foreground text-xs">
        Off, no photo page shows its title, whatever its layout says. The titles are kept for
        turning them back on. A layout can leave titles out on its own pages too, on the Layouts
        tab.
      </p>
    </fieldset>
  );
}
