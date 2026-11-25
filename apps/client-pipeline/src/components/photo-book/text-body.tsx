import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { PageActions, PageParts } from "@/components/photo-book/page-types";
import { type BookPage, TEXT_PAGE_PHOTOS } from "@/lib/photo-book";
import { TEXT_PAGE_COLUMNS, textColumns } from "@/lib/photo-book-text";
import { cn } from "@/lib/utils";

/** Keeps each line break written. */
const MARKDOWN_PLUGINS = [remarkBreaks];

/**
 * How a text page's Markdown looks: white on the page's black, sized with the page, so it prints as
 * it shows at any size.
 */
const TEXT_CLASSES = [
  "text-[1.9cqw] leading-[1.45] break-words [&>*:first-child]:mt-0",
  "[&_p]:mb-[0.8em] [&_ul]:mb-[0.8em] [&_ul]:list-disc [&_ul]:pl-[1.2em] [&_ol]:mb-[0.8em] [&_ol]:list-decimal [&_ol]:pl-[1.2em]",
  "[&_h1]:mb-[0.4em] [&_h1]:text-[1.6em] [&_h1]:font-bold [&_h2]:mb-[0.4em] [&_h2]:text-[1.3em] [&_h2]:font-bold [&_h3]:mb-[0.3em] [&_h3]:font-bold",
  "[&_h1]:break-after-avoid [&_h2]:break-after-avoid [&_h3]:break-after-avoid [&_li]:break-inside-avoid",
  "[&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-500 [&_blockquote]:pl-[0.8em] [&_blockquote]:italic [&_hr]:my-[0.8em] [&_hr]:border-neutral-600",
  "[&_code]:font-mono [&_strong]:font-bold [&_em]:italic",
].join(" ");

/**
 * A text page's text: its Markdown drawn in its columns, the text reflowing from one column to the
 * next; clicked, a box to write it in, until it loses focus.
 */
function PageText(props: { text: string; columns: number; onText: (text: string) => void }) {
  const { text, columns, onText } = props;
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <textarea
        aria-label="Page text, in Markdown"
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- it opens where the text was just clicked
        autoFocus
        value={text}
        placeholder="Text, in Markdown"
        onChange={(event) => onText(event.target.value)}
        onBlur={() => setEditing(false)}
        className="min-h-0 flex-1 resize-none rounded-sm bg-white/10 p-[1%] font-mono text-[1.6cqw] leading-snug outline-none"
      />
    );
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Edit the page's text"
      onClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") setEditing(true);
      }}
      style={{ columnCount: columns, columnGap: "4%" }}
      className={cn(
        "min-h-0 flex-1 cursor-text overflow-hidden rounded-sm hover:bg-white/5 in-data-[preview]:hover:bg-transparent",
        TEXT_CLASSES,
      )}
    >
      {text.trim() ? (
        <Markdown remarkPlugins={MARKDOWN_PLUGINS}>{text}</Markdown>
      ) : (
        <span className="text-neutral-600 in-data-[print]:invisible">
          Text, in Markdown: **bold**, *italic*, # headings, - lists
        </span>
      )}
    </div>
  );
}

/** A small − n + stepper on the page, for editing only. */
function Stepper(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const { label, value, min, max, onChange } = props;
  const button = "rounded-sm p-[0.3em] hover:bg-white/15 disabled:opacity-30";
  return (
    <span className="flex items-center gap-[0.4em]">
      {label}
      <button
        type="button"
        aria-label={`Fewer ${label.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className={button}
      >
        <MinusIcon className="size-[1.2em]" />
      </button>
      <span className="w-[1em] text-center tabular-nums">{value}</span>
      <button
        type="button"
        aria-label={`More ${label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={button}
      >
        <PlusIcon className="size-[1.2em]" />
      </button>
    </span>
  );
}

/** A text page's photos in a row under its text, each caption under its photo. */
function TextPagePhotos({ parts, count }: { parts: PageParts; count: number }) {
  return (
    <div
      className="grid h-[42%] shrink-0 gap-[2%]"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex min-h-0 min-w-0 flex-col gap-[3%]">
          {parts.slot(i, "fill", "min-h-0 flex-1")}
          {parts.caption(i, "shrink-0")}
        </div>
      ))}
    </div>
  );
}

/**
 * A text page: its title, its Markdown text in 1 to 3 columns, and up to 4 photos in a row under
 * it, with steppers for the columns and photos that only show while editing.
 */
export function TextBody(props: { parts: PageParts; page: BookPage; actions: PageActions }) {
  const { parts, page, actions } = props;
  const columns = textColumns(page);
  const photos = page.slots.length;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[3%]">
      {parts.title}
      <PageText text={page.text ?? ""} columns={columns} onText={actions.onText} />
      {photos > 0 && <TextPagePhotos parts={parts} count={photos} />}
      <div className="flex shrink-0 justify-end gap-[3%] text-[1.4cqw] text-neutral-400 in-data-[preview]:hidden">
        <Stepper
          label="Columns"
          value={columns}
          min={1}
          max={TEXT_PAGE_COLUMNS}
          onChange={actions.onColumns}
        />
        <Stepper
          label="Photos"
          value={photos}
          min={0}
          max={TEXT_PAGE_PHOTOS}
          onChange={actions.onPhotoPlaces}
        />
      </div>
    </div>
  );
}
