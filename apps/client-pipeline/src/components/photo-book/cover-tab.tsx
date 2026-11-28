import type { ReactNode } from "react";
import { BlurbPdfButton } from "@/components/photo-book/blurb-pdf";
import { CoverSheet } from "@/components/photo-book/book-cover";
import type { PageLook } from "@/components/photo-book/page-actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BookCover, PhotoBook } from "@/lib/photo-book";
import {
  blurbOf,
  blurbWarnings,
  coverOf,
  coverWarnings,
  inches,
  setCover,
} from "@/lib/photo-book-cover";
import { unitsInBook } from "@/lib/photo-book-order";

interface CoverTabProps {
  book: PhotoBook;
  update: (book: PhotoBook) => void;
  look: PageLook;
}

/**
 * A book's Cover tab: the cover's words and colors beside a preview of the whole cover as Blurb
 * prints it (back, spine and front, with dashed lines where Blurb trims it and the spine folds), in
 * the style of Serven Up Photos Vol. 3, what to watch for in Blurb's PDFs, and **Save cover PDF for
 * Blurb**.
 */
export function CoverTab({ book, update, look }: CoverTabProps) {
  const cover = coverOf(book);
  const sizes = blurbOf(book);
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <CoverFields key={book.id} book={book} update={update} />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Back, spine and front, {inches(sizes.coverWidth)} × {inches(sizes.coverHeight)} with a{" "}
            {inches(sizes.spine)} spine. Blurb's sizes are on the Info tab.
          </p>
          <BlurbPdfButton book={book} look={look} used={unitsInBook(book)} coverOnly />
        </div>
        <CoverSheet cover={cover} sizes={sizes} guides />
        <ul className="text-muted-foreground list-disc pl-5 text-xs">
          {[...coverWarnings(sizes), ...blurbWarnings(book)].map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** One labelled field of the cover's. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      {children}
    </label>
  );
}

/**
 * The cover's words and colors, each saved as it's typed: the title one line of the cover a line,
 * the author, the volume, the spine's text, and the background and text colors.
 */
function CoverFields({ book, update }: { book: PhotoBook; update: (book: PhotoBook) => void }) {
  const cover = coverOf(book);
  const set = (change: Partial<BookCover>) => update(setCover(book, change));
  const text = (field: "author" | "volume" | "spine", placeholder: string) => (
    <Input
      defaultValue={cover[field]}
      placeholder={placeholder}
      onChange={(event) => set({ [field]: event.target.value })}
    />
  );
  const color = (field: "background" | "color") => (
    <input
      type="color"
      value={cover[field]}
      onChange={(event) => set({ [field]: event.target.value })}
      className="border-input h-9 w-16 rounded-md border"
    />
  );
  return (
    <div className="flex w-full flex-col gap-3 lg:w-72 lg:shrink-0">
      <Field label="Title, one line of the cover a line">
        <Textarea
          rows={4}
          defaultValue={cover.title}
          onChange={(event) => set({ title: event.target.value })}
        />
      </Field>
      <Field label="Author">{text("author", "Emily Serven")}</Field>
      <Field label="Volume">{text("volume", "Vol. 4")}</Field>
      <Field label="Spine">{text("spine", "Serven Up Photos Vol. 4")}</Field>
      <div className="flex gap-4">
        <Field label="Background">{color("background")}</Field>
        <Field label="Text">{color("color")}</Field>
      </div>
    </div>
  );
}
