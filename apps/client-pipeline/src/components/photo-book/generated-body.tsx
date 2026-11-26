import { useRef } from "react";
import { useFitScale } from "@/components/photo-book/use-fit-scale";
import { usePagesNeeded } from "@/components/photo-book/use-pages-needed";
import type { BookPage } from "@/lib/photo-book";
import { entrySize, entryTextStyle } from "@/lib/photo-book-entry-sizes";
import {
  type GeneratedPage,
  generatedColumns,
  generatedTextSize,
} from "@/lib/photo-book-generated";
import { generatedPageCount, generatedPart } from "@/lib/photo-book-generated-pages";
import type { IndexEntry } from "@/lib/photo-book-places-index";
import { cn } from "@/lib/utils";
import { count as countOf } from "@portfolio/lib/words";

/** How each depth of the index is written, outermost first; deeper ones look like the last. */
const DEPTH_CLASSES = [
  "mt-[0.9em] text-[1.15em] font-bold uppercase tracking-wide",
  "mt-[0.35em] font-bold",
  "",
  "text-neutral-300",
];

/** How the index's lines are sized: each entry's own size, and whether lines shrink to fit. */
type LineSizes = Pick<GeneratedPage, "entrySizes" | "fitLines">;

/**
 * One entry's line: its name at the entry's own size, shrunk a little more to stay on one line
 * when **Shrink lines to fit** is on and that's enough.
 */
function EntryLine(props: { entry: IndexEntry; depth: number; sizes: LineSizes }) {
  const { entry, depth, sizes } = props;
  const line = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const size = entrySize(sizes, entry.key) / 100;
  const fit = useFitScale(line, text, { on: sizes.fitLines === true, size, name: entry.name });
  return (
    <span
      ref={line}
      className={cn(
        "block break-inside-avoid",
        entry.children.length > 0 && "break-after-avoid",
        DEPTH_CLASSES[Math.min(depth, DEPTH_CLASSES.length - 1)],
      )}
    >
      <span ref={text} style={entryTextStyle(size, fit)}>
        {entry.name}
      </span>
    </span>
  );
}

/** The index's entries, each with the entries in it indented under it. */
function Entries(props: { entries: IndexEntry[]; depth: number; sizes: LineSizes }) {
  const { entries, depth, sizes } = props;
  return (
    <ul className={cn(depth > 0 && "pl-[1.2em]")}>
      {entries.map((entry) => (
        <li key={entry.key}>
          <EntryLine entry={entry} depth={depth} sizes={sizes} />
          {entry.children.length > 0 && (
            <Entries entries={entry.children} depth={depth + 1} sizes={sizes} />
          )}
        </li>
      ))}
    </ul>
  );
}

/** A generated page's heading; on the pages it runs on to, the same room left empty, so every page's list starts level. */
function Heading({ title, first }: { title: string | null; first: boolean }) {
  if (!title) return null;
  return (
    <h2
      aria-hidden={!first}
      className={cn(
        "shrink-0 text-[4.4cqw] leading-none font-bold uppercase",
        !first && "invisible",
      )}
    >
      {title}
    </h2>
  );
}

/** The gap between columns, and between one page's columns and the next page's. */
const COLUMN_GAP = "3cqw";

/** Where the page is among the pages its list runs on across: 0 for the first, of count. */
interface Part {
  at: number;
  count: number;
}

/** What the mark on the last page says, and its color: red when the list needs more pages. */
function fitText(needed: number, count: number) {
  if (needed > count) {
    return {
      text: `Runs past this page: needs ${needed} pages. Set Pages in its options.`,
      color: "bg-red-600",
    };
  }
  return {
    text: `Fits on ${countOf(needed, "page")}: set Pages in its options.`,
    color: "bg-neutral-600",
  };
}

/**
 * A mark on the last page when the list doesn't fit the pages it has, or fits on fewer; never
 * printed.
 */
function FitMark({ needed, count }: { needed: number | null; count: number }) {
  if (needed === null || needed === count) return null;
  const { text, color } = fitText(needed, count);
  return (
    <span
      className={cn(
        "absolute right-0 bottom-0 rounded px-1 text-[10px] font-medium text-white in-data-[print]:hidden",
        color,
      )}
    >
      {text}
    </span>
  );
}

/** What the Places Index is drawn from: its entries, columns, text size, line sizes and which page this is. */
interface IndexProps {
  entries: IndexEntry[];
  columns: number;
  size: number;
  sizes: LineSizes;
  part: Part;
}

/**
 * The Places Index as one flow of columns, its text at size percent of the usual size, across all the pages it runs on, each page showing its
 * own window of it: the flow is as wide as every page's room side by side, and filled column by
 * column, so it runs on from one page to the next as a long text does.
 */
function IndexFlow(props: IndexProps) {
  const { entries, columns, size, sizes, part } = props;
  const window = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  const last = part.at === part.count - 1;
  const needed = usePagesNeeded(window, flow);
  return (
    <div ref={window} className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={flow}
        style={{
          width: `calc(${part.count} * 100% + ${part.count - 1} * ${COLUMN_GAP})`,
          left: `calc(${-part.at} * (100% + ${COLUMN_GAP}))`,
          columnCount: part.count * columns,
          columnGap: COLUMN_GAP,
          columnFill: "auto",
          fontSize: `${(2 * size) / 100}cqw`,
        }}
        className="absolute inset-y-0 text-left leading-[1.4] break-words [&>ul>li:first-child>span]:mt-0"
      >
        <Entries entries={entries} depth={0} sizes={sizes} />
      </div>
      {last && <FitMark needed={needed} count={part.count} />}
    </div>
  );
}

/** The Places Index, or a note, not printed, while it has no places. */
function IndexColumns(props: IndexProps) {
  if (props.entries.length > 0) return <IndexFlow {...props} />;
  if (props.part.at > 0) return null;
  return (
    <p className="text-left text-[2cqw] text-neutral-500 in-data-[print]:invisible">
      The pages in the book show no places yet.
    </p>
  );
}

/** Nothing to list, where no page is generated. */
const NO_INDEX = (): IndexEntry[] => [];

/**
 * A generated page: its heading, then what it's generated from the book, such as a Places Index,
 * flowing into its columns and on across the pages it runs on to. It's drawn from the book each
 * time, so it has nothing to type in.
 */
export function GeneratedBody(props: {
  page: BookPage & { generated: GeneratedPage };
  placesIndexFor?: (generated: GeneratedPage) => IndexEntry[];
}) {
  const { page, placesIndexFor = NO_INDEX } = props;
  const part = { at: generatedPart(page), count: generatedPageCount(page) };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[3%] text-left">
      <Heading title={page.title} first={part.at === 0} />
      <IndexColumns
        entries={placesIndexFor(page.generated)}
        columns={generatedColumns(page.generated)}
        size={generatedTextSize(page.generated)}
        sizes={page.generated}
        part={part}
      />
    </div>
  );
}
