import type { ReactNode } from "react";
import type { PageLayout } from "@/lib/photo-book";
import { cn } from "@/lib/utils";

const PHOTO = "rounded-[1px] bg-current opacity-70";

const LINES = (
  <span className="flex flex-col justify-center gap-[2px]">
    <span className="h-px w-full bg-current opacity-60" />
    <span className="h-px w-3/4 bg-current opacity-60" />
  </span>
);

/** Whether the layout puts its photos on the left and its captions on the right. */
function photosLeft(layout: PageLayout): boolean {
  return layout === "pair-left" || layout === "verticals-left";
}

/** The photos and the captions side by side, the photos on the side the layout says. */
function sides(layout: PageLayout, photos: ReactNode, captions: ReactNode, key?: number) {
  const left = photosLeft(layout);
  return (
    <span
      key={key}
      className={cn("grid gap-[2px]", left ? "grid-cols-[3fr_2fr]" : "grid-cols-[2fr_3fr]")}
    >
      {left ? [photos, captions] : [captions, photos]}
    </span>
  );
}

/** The drawing inside the glyph's border for layout. */
function glyphBody(layout: PageLayout): ReactNode {
  if (layout === "full") {
    return (
      <span className="flex w-full flex-col gap-[2px]">
        <span className={cn(PHOTO, "flex-1")} />
        <span className="mx-auto h-px w-2/3 bg-current opacity-60" />
      </span>
    );
  }
  if (layout === "verticals-left" || layout === "verticals-right") {
    const photos = (
      <span key="photos" className="grid grid-cols-2 gap-[2px]">
        <span className={PHOTO} />
        <span className={PHOTO} />
      </span>
    );
    return (
      <span className="grid w-full">{sides(layout, photos, <span key="lines">{LINES}</span>)}</span>
    );
  }
  return (
    <span className="grid w-full grid-rows-2 gap-[2px]">
      {[0, 1].map((i) =>
        sides(layout, <span key="photo" className={PHOTO} />, <span key="lines">{LINES}</span>, i),
      )}
    </span>
  );
}

/**
 * A small drawing of a page layout: filled boxes for its photos and lines for its captions, for
 * the layout buttons and the Add page picker.
 */
export function LayoutGlyph({ layout, className }: { layout: PageLayout; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex rounded-[2px] border border-current p-[2px]", className)}
    >
      {glyphBody(layout)}
    </span>
  );
}
