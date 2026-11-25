import { PageBody } from "@/components/photo-book/page-body";
import { PageControls } from "@/components/photo-book/page-controls";
import { type BookPageProps, pageName } from "@/components/photo-book/page-types";
import { inBook } from "@/lib/photo-book";
import { cn } from "@/lib/utils";

/**
 * One page of the book: its controls above it, and the page itself in its layout, faded when it's
 * left out of the book.
 */
export function BookPage(props: BookPageProps) {
  const { page, index, number, actions } = props;
  const label = number === null ? `Left-out page, ${index + 1} of the pages` : pageName(number);
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <PageControls {...props} />
      <div
        className={cn(
          "aspect-[22/17] rounded-sm border bg-white p-[4%] text-neutral-900 shadow-sm dark:bg-neutral-100",
          !inBook(page) && "border-dashed opacity-60",
        )}
      >
        <div className="flex size-full flex-col gap-[4%]">
          {page.title !== null && (
            <input
              aria-label={`${pageName(number)} title`}
              value={page.title}
              placeholder="Page title"
              onChange={(event) => actions.onTitle(event.target.value)}
              className="w-full shrink-0 rounded-sm bg-transparent text-center font-serif text-base font-semibold outline-none placeholder:text-neutral-400 hover:bg-neutral-200/60 focus:bg-neutral-200/60"
            />
          )}
          <PageBody {...props} />
        </div>
      </div>
    </section>
  );
}
