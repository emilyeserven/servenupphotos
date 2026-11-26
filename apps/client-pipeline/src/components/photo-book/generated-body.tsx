import type { BookPage } from "@/lib/photo-book";
import { type GeneratedPage, generatedColumns } from "@/lib/photo-book-generated";
import type { IndexEntry } from "@/lib/photo-book-places-index";
import { cn } from "@/lib/utils";

/** How each depth of the index is written, outermost first; deeper ones look like the last. */
const DEPTH_CLASSES = [
  "mt-[0.9em] text-[1.15em] font-bold uppercase tracking-wide",
  "mt-[0.35em] font-bold",
  "",
  "text-neutral-300",
];

/** The index's entries, each with the entries in it indented under it. */
function Entries({ entries, depth }: { entries: IndexEntry[]; depth: number }) {
  return (
    <ul className={cn(depth > 0 && "pl-[1.2em]")}>
      {entries.map((entry) => (
        <li key={entry.key}>
          <span
            className={cn(
              "block break-inside-avoid",
              entry.children.length > 0 && "break-after-avoid",
              DEPTH_CLASSES[Math.min(depth, DEPTH_CLASSES.length - 1)],
            )}
          >
            {entry.name}
          </span>
          {entry.children.length > 0 && <Entries entries={entry.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

/** A generated page's heading; nothing when it has none. */
function Heading({ title }: { title: string | null }) {
  if (!title) return null;
  return <h2 className="shrink-0 text-[4.4cqw] leading-none font-bold uppercase">{title}</h2>;
}

/** The Places Index, flowing into the page's columns; a note, not printed, while it has no places. */
function IndexColumns({ entries, columns }: { entries: IndexEntry[]; columns: number }) {
  if (entries.length === 0) {
    return (
      <p className="text-left text-[2cqw] text-neutral-500 in-data-[print]:invisible">
        The pages in the book show no places yet.
      </p>
    );
  }
  return (
    <div
      style={{ columnCount: columns, columnGap: "4%" }}
      className="min-h-0 flex-1 overflow-hidden text-left text-[2cqw] leading-[1.4] break-words [&>ul>li:first-child>span]:mt-0"
    >
      <Entries entries={entries} depth={0} />
    </div>
  );
}

/** Nothing to list, where no page is generated. */
const NO_INDEX = (): IndexEntry[] => [];

/**
 * A generated page: its heading, then what it's generated from the book, such as a Places Index,
 * flowing into its columns. It's drawn from the book each time, so it has nothing to type in.
 */
export function GeneratedBody(props: {
  page: BookPage & { generated: GeneratedPage };
  placesIndexFor?: (generated: GeneratedPage) => IndexEntry[];
}) {
  const { page, placesIndexFor = NO_INDEX } = props;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[3%] text-left">
      <Heading title={page.title} />
      <IndexColumns
        entries={placesIndexFor(page.generated)}
        columns={generatedColumns(page.generated)}
      />
    </div>
  );
}
