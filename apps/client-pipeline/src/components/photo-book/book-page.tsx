import { PageBody } from "@/components/photo-book/page-body";
import { type BookPageProps, pageName } from "@/components/photo-book/page-types";
import { PAGE_SHEET_ATTRIBUTE } from "@/components/photo-book/use-slot-dpi";
import { cn } from "@/lib/utils";

/** The look of a printed page: black, Helvetica, white text, in the book's shape. */
const PAGE_CLASS = "bg-black p-[2.5%] font-[Helvetica_Neue,Helvetica,Arial,sans-serif] text-white";

/**
 * One page of the book: its controls above it, and the page itself in its layout, styled like the
 * printed books, in the shape the book's size gives it.
 */
export function BookPage(props: BookPageProps & { className?: string }) {
  const { page, aspect, controls, className } = props;
  return (
    <section
      aria-label={pageName(page)}
      data-page-id={page.id}
      className={cn("flex min-w-0 flex-col gap-2", className)}
    >
      {controls}
      <PageSheet aspect={aspect}>
        <PageBody {...props} />
      </PageSheet>
    </section>
  );
}

/** The black sheet of paper a page is drawn on, in the book's shape. */
function PageSheet({ aspect, children }: { aspect: number; children: React.ReactNode }) {
  return (
    <div
      {...{ [PAGE_SHEET_ATTRIBUTE]: "" }}
      style={{ containerType: "inline-size", aspectRatio: aspect }}
      className={cn(
        "w-full overflow-hidden rounded-sm border border-neutral-800 shadow-sm in-data-[print]:rounded-none in-data-[print]:border-0 in-data-[print]:shadow-none",
        PAGE_CLASS,
      )}
    >
      <div className="flex size-full flex-col">{children}</div>
    </div>
  );
}
