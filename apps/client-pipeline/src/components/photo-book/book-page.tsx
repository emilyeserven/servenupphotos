import { PageBody } from "@/components/photo-book/page-body";
import { type BookPageProps, pageName } from "@/components/photo-book/page-types";

/**
 * One page of the book: its controls above it, and the page itself in its layout, styled like the
 * printed books (a black 900 × 765 page, Helvetica, white text).
 */
export function BookPage(props: BookPageProps) {
  const { index, number, controls } = props;
  const label =
    number === null ? `Page ${index + 1} of the pages, not in the book` : pageName(number);
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      {controls}
      <div
        style={{ containerType: "inline-size" }}
        className="aspect-[900/765] rounded-sm border border-neutral-800 bg-black p-[2.5%] font-[Helvetica_Neue,Helvetica,Arial,sans-serif] text-white shadow-sm"
      >
        <div className="flex size-full flex-col">
          <PageBody {...props} />
        </div>
      </div>
    </section>
  );
}
