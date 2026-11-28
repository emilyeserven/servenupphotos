import { Input } from "@/components/ui/input";
import type { BlurbSizes, PhotoBook } from "@/lib/photo-book";
import { DEFAULT_BLURB, blurbOf, setBlurb } from "@/lib/photo-book-cover";

/** Each of Blurb's sizes, in the order the fields show them, with its label. */
const FIELDS: [keyof BlurbSizes, string][] = [
  ["pageWidth", "Page PDF width"],
  ["pageHeight", "Page PDF height"],
  ["coverWidth", "Cover PDF width"],
  ["coverHeight", "Cover PDF height"],
  ["spine", "Spine width"],
  ["bleed", "Cover bleed"],
];

/**
 * **Blurb sizes** on a book's Info tab: the sizes, in inches, Blurb's specifications give for the
 * book's PDFs, which **PDF for Blurb** and the Cover tab use: each page's PDF, the cover's PDF, the
 * spine's width and the cover's bleed. They start as a 78-page Large Landscape hardcover ImageWrap
 * book's; the spine, and so the cover's width, grows with the page count. A size that leaves no
 * room for the cover's front and back isn't saved.
 */
export function BlurbSizesField(props: { book: PhotoBook; onChange: (book: PhotoBook) => void }) {
  const { book, onChange } = props;
  const sizes = blurbOf(book);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Blurb sizes</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FIELDS.map(([field, label]) => (
          <label key={field} className="flex flex-col gap-1 text-sm">
            <span>{label} (in)</span>
            <Input
              type="number"
              min={0}
              step="any"
              defaultValue={sizes[field]}
              placeholder={String(DEFAULT_BLURB[field])}
              onChange={(event) => {
                const n = Number(event.target.value);
                if (event.target.value !== "" && Number.isFinite(n))
                  onChange(setBlurb(book, { [field]: n }));
              }}
            />
          </label>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        From Blurb's specifications for the book's size, paper and page count: "Final, exported PDF
        should measure" for the pages and the cover, the cover's gutter / spine width and its bleed.
        Make the cover last, once the page count is final, since the spine grows with it.
      </p>
    </fieldset>
  );
}
