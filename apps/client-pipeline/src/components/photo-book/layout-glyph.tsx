import type { PageLayout } from "@/lib/photo-book";
import { cn } from "@/lib/utils";

/**
 * A small drawing of a page layout: filled boxes for its photos and lines for its captions, for
 * the layout buttons and the Add page picker.
 */
export function LayoutGlyph({ layout, className }: { layout: PageLayout; className?: string }) {
  const photo = "rounded-[1px] bg-current opacity-70";
  const lines = (
    <span className="flex flex-col justify-center gap-[2px]">
      <span className="h-px w-full bg-current opacity-60" />
      <span className="h-px w-3/4 bg-current opacity-60" />
    </span>
  );
  return (
    <span
      aria-hidden
      className={cn("inline-flex rounded-[2px] border border-current p-[2px]", className)}
    >
      {layout === "full" ? (
        <span className="flex w-full flex-col gap-[2px]">
          <span className={cn(photo, "flex-1")} />
          <span className="mx-auto h-px w-2/3 bg-current opacity-60" />
        </span>
      ) : (
        <span className="grid w-full grid-rows-2 gap-[2px]">
          {[0, 1].map((i) => (
            <span
              key={i}
              className={cn(
                "grid gap-[2px]",
                layout === "pair-left" ? "grid-cols-[3fr_2fr]" : "grid-cols-[2fr_3fr]",
              )}
            >
              {layout === "pair-left" ? (
                <>
                  <span className={photo} />
                  {lines}
                </>
              ) : (
                <>
                  {lines}
                  <span className={photo} />
                </>
              )}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
