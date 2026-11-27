import type { PhotoBook } from "@/lib/photo-book";

/**
 * **Caption titles** on a book's Info tab: whether its captions start with the photo's title in
 * bold. Off, each caption filled in from the template leaves its first line, the title, off and
 * draws the lines left alike, on the pages and in the PDF; a caption typed over is drawn as typed.
 */
export function CaptionTitlesField(props: {
  book: PhotoBook;
  onChange: (book: PhotoBook) => void;
}) {
  const { book, onChange } = props;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Caption titles</legend>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={book.noCaptionTitles !== true}
          onChange={(event) => {
            const { noCaptionTitles: _off, ...rest } = book;
            onChange(event.target.checked ? rest : { ...book, noCaptionTitles: true });
          }}
        />
        Start captions with the photo&apos;s title
      </label>
      <p className="text-muted-foreground text-xs">
        Off, captions leave their first line, the title, out and draw every line alike, with none of
        them bold. To leave out one photo&apos;s title, hide its first line under{" "}
        <strong>Hide places</strong> on its page. A caption typed over has no title when its first
        line is blank.
      </p>
    </fieldset>
  );
}
